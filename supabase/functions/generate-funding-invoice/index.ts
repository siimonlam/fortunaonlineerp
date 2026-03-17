import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GoogleAuthToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

async function getServiceAccountToken(): Promise<string> {
  const serviceAccountEmail = "fortunaerp@fortuna-erp.iam.gserviceaccount.com";
  const privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");

  if (!privateKey) {
    throw new Error("Service account private key not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents",
    aud: "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedClaimSet = btoa(JSON.stringify(claimSet)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const cleanedKey = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\n/g, "")
    .replace(/\s/g, "");

  let binaryKey: Uint8Array;
  try {
    binaryKey = Uint8Array.from(atob(cleanedKey), c => c.charCodeAt(0));
  } catch (e) {
    throw new Error("Invalid private key format");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${signatureInput}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData: GoogleAuthToken = await tokenResponse.json();
  return tokenData.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      invoiceNumber,
      invoiceFolderId,
      issueDate,
      dueDate,
      amount,
      paymentType,
      remark,
      issuedCompany,
      category,
      companyName,
      companyNameChinese,
      contactName,
      contactNumber,
      address,
      projectTitle,
      projectReference,
      applicationNumber,
      fundingScheme,
      clientNumber,
    } = await req.json();

    const { data: templateSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'funding_invoice_template_doc_id')
      .maybeSingle();

    const templateDocId = templateSettings?.value;

    if (!templateDocId) {
      return new Response(
        JSON.stringify({ error: 'Funding invoice template not configured. Please set funding_invoice_template_doc_id in Funding Project > Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: folderSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'funding_invoice_folder_id')
      .maybeSingle();

    const targetFolderId = invoiceFolderId || folderSettings?.value;

    if (!targetFolderId) {
      return new Response(
        JSON.stringify({ error: 'Invoice folder not configured. Please set a destination folder in Funding Project > Settings > Invoice Folder.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await getServiceAccountToken();

    // Get the parent folder details to check if it's a Shared Drive
    const folderResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${targetFolderId}?fields=driveId,parents&supportsAllDrives=true`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!folderResponse.ok) {
      throw new Error('Failed to verify target folder. Make sure the service account has access to the folder.');
    }

    const folderData = await folderResponse.json();
    const driveId = folderData.driveId; // Will be set if folder is in a Shared Drive

    // Also check if the template is in a Shared Drive
    const templateResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${templateDocId}?fields=driveId,parents&supportsAllDrives=true`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!templateResponse.ok) {
      throw new Error('Failed to verify template document. Make sure the service account has access to the template.');
    }

    const templateData = await templateResponse.json();
    const templateDriveId = templateData.driveId;

    // WORKAROUND: Google Drive API has an issue where copying to Shared Drive
    // can trigger storage quota errors. The solution is to:
    // 1. First copy without specifying parent (creates in template's location)
    // 2. Then move the copy to the target folder

    console.log(`Template drive: ${templateDriveId || 'My Drive'}, Target drive: ${driveId || 'My Drive'}`);

    let newDocId: string;

    // Step 1: Create the copy without parent (stays in same location as template)
    const copyBodyNoParent = {
      name: `${invoiceNumber} - ${companyName}`,
    };

    const copyUrlNoParent = `https://www.googleapis.com/drive/v3/files/${templateDocId}/copy?supportsAllDrives=true`;

    const copyResponseNoParent = await fetch(copyUrlNoParent, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(copyBodyNoParent),
    });

    if (!copyResponseNoParent.ok) {
      const error = await copyResponseNoParent.text();
      throw new Error(`Failed to copy template: ${error}`);
    }

    const copyDataNoParent = await copyResponseNoParent.json();
    newDocId = copyDataNoParent.id;

    console.log(`Created copy with ID: ${newDocId}`);

    // Step 2: Move the file to the target folder if needed
    const currentParents = copyDataNoParent.parents || [];
    if (currentParents.length === 0 || currentParents[0] !== targetFolderId) {
      console.log(`Moving file from ${currentParents.join(', ')} to ${targetFolderId}`);

      const moveParams = new URLSearchParams({
        addParents: targetFolderId,
        removeParents: currentParents.join(','),
        supportsAllDrives: 'true',
      });

      const moveUrl = `https://www.googleapis.com/drive/v3/files/${newDocId}?${moveParams.toString()}`;

      const moveResponse = await fetch(moveUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!moveResponse.ok) {
        const moveError = await moveResponse.text();
        console.error(`Failed to move file: ${moveError}`);
        // Try to delete the orphaned copy
        await fetch(`https://www.googleapis.com/drive/v3/files/${newDocId}?supportsAllDrives=true`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        throw new Error(`Failed to move file to target folder: ${moveError}`);
      }

      console.log(`Successfully moved file to ${targetFolderId}`);
    }

    let fileMetadata: any;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const fileMetadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${newDocId}?fields=mimeType,name&supportsAllDrives=true`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!fileMetadataResponse.ok) {
        throw new Error('Failed to verify copied document');
      }

      fileMetadata = await fileMetadataResponse.json();

      if (fileMetadata.mimeType === 'application/vnd.google-apps.document') {
        break;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    if (fileMetadata.mimeType !== 'application/vnd.google-apps.document') {
      throw new Error(`Template must be a Google Doc, but got: ${fileMetadata.mimeType}`);
    }

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        return new Date(dateStr).toLocaleDateString('en-GB');
      } catch {
        return dateStr;
      }
    };

    const formatCurrency = (val: any) => {
      const num = parseFloat(val) || 0;
      return `HK$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const replacements: Record<string, string> = {
      '{{INVOICE_NUMBER}}': invoiceNumber || '',
      '{{ISSUE_DATE}}': formatDate(issueDate),
      '{{DUE_DATE}}': formatDate(dueDate),
      '{{AMOUNT}}': formatCurrency(amount),
      '{{PAYMENT_TYPE}}': paymentType || '',
      '{{REMARK}}': remark || '',
      '{{ISSUED_COMPANY}}': issuedCompany || 'Amazing Channel (HK) Limited',
      '{{CATEGORY}}': category || '',
      '{{COMPANY_NAME}}': companyName || '',
      '{{COMPANY_NAME_CHINESE}}': companyNameChinese || '',
      '{{CONTACT_NAME}}': contactName || '',
      '{{CONTACT_NUMBER}}': contactNumber || '',
      '{{ADDRESS}}': address || '',
      '{{PROJECT_TITLE}}': projectTitle || '',
      '{{PROJECT_REFERENCE}}': projectReference || '',
      '{{APPLICATION_NUMBER}}': applicationNumber || '',
      '{{FUNDING_SCHEME}}': fundingScheme || '',
      '{{CLIENT_NUMBER}}': clientNumber || '',
    };

    const requests = Object.entries(replacements).map(([placeholder, value]) => ({
      replaceAllText: {
        containsText: { text: placeholder, matchCase: true },
        replaceText: value,
      },
    }));

    const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${newDocId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update document: ${error}`);
    }

    const googleDocUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
    const previewUrl = `https://docs.google.com/document/d/${newDocId}/preview`;

    return new Response(
      JSON.stringify({
        success: true,
        documentId: newDocId,
        googleDocUrl,
        previewUrl,
        invoiceNumber,
        companyName,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating funding invoice:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate funding invoice' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
