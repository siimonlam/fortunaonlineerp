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
    throw new Error("Service account private key not configured for funding");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claimSet = {
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents",
    aud: "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const encodedClaimSet = btoa(JSON.stringify(claimSet))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  let cleanedKey = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\n/g, "")
    .replace(/\s/g, "");

  let binaryKey: Uint8Array;
  try {
    binaryKey = Uint8Array.from(atob(cleanedKey), c => c.charCodeAt(0));
  } catch (e) {
    console.error("Failed to decode private key:", e);
    throw new Error("Invalid private key format");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      invoiceId,
      invoiceNumber,
      issueDate,
      dueDate,
      paymentType,
      amount,
      remark,
      projectId,
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

    console.log('Generating funding invoice PDF for:', companyName, projectTitle);

    // Fetch template ID from system settings
    const { data: templateSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'funding_invoice_template_doc_id')
      .maybeSingle();

    const templateDocId = templateSettings?.value;

    if (!templateDocId) {
      return new Response(
        JSON.stringify({ error: 'Invoice template not configured. Please set funding_invoice_template_doc_id in system settings.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch folder ID from system settings
    const { data: folderSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'funding_invoice_folder_id')
      .maybeSingle();

    const invoiceFolderId = folderSettings?.value;

    if (!invoiceFolderId) {
      return new Response(
        JSON.stringify({ error: 'Invoice folder not configured. Please set funding_invoice_folder_id in system settings.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const accessToken = await getServiceAccountToken();

    // Copy the template document
    const copyResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${templateDocId}/copy?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${invoiceNumber} - ${companyName}`,
        parents: [invoiceFolderId],
      }),
    });

    if (!copyResponse.ok) {
      const error = await copyResponse.text();
      throw new Error(`Failed to copy template: ${error}`);
    }

    const copyData = await copyResponse.json();
    const newDocId = copyData.id;

    console.log('Created copy of template:', newDocId);

    // Poll until the document is ready (with timeout)
    let fileMetadata: any;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const fileMetadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${newDocId}?fields=mimeType,name&supportsAllDrives=true`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!fileMetadataResponse.ok) {
        throw new Error('Failed to verify copied document');
      }

      fileMetadata = await fileMetadataResponse.json();
      console.log(`Attempt ${attempts + 1}: Document metadata:`, fileMetadata);

      if (fileMetadata.mimeType === 'application/vnd.google-apps.document') {
        console.log('Document is ready as Google Doc');
        break;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    if (fileMetadata.mimeType !== 'application/vnd.google-apps.document') {
      throw new Error(`Template must be a Google Doc, but got: ${fileMetadata.mimeType}. Please ensure the template is a Google Doc (not Sheets, Slides, or PDF).`);
    }

    // Prepare replacements for the funding invoice
    const replacements: Record<string, string> = {
      '{{INVOICE_NUMBER}}': invoiceNumber,
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
      '{{ISSUE_DATE}}': new Date(issueDate).toLocaleDateString('en-GB'),
      '{{DUE_DATE}}': dueDate ? new Date(dueDate).toLocaleDateString('en-GB') : '',
      '{{PAYMENT_TYPE}}': paymentType,
      '{{AMOUNT}}': `HK$${parseFloat(amount).toFixed(2)}`,
      '{{ISSUED_COMPANY}}': issuedCompany || '',
      '{{CATEGORY}}': category || '',
      '{{REMARK}}': remark || '',
      '{{NOTES}}': remark || '',
    };

    const requests = Object.entries(replacements)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([placeholder, value]) => {
        const safeValue = String(value);

        return {
          replaceAllText: {
            containsText: {
              text: placeholder,
              matchCase: true,
            },
            replaceText: safeValue.substring(0, 50),
          },
        };
      });

    const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${newDocId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests,
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update document: ${error}`);
    }

    console.log('Updated document with funding invoice data');

    const googleDocUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
    const previewUrl = `https://docs.google.com/document/d/${newDocId}/preview`;

    // Update the funding_invoices table with the Google Doc URL
    if (invoiceId) {
      const { error: updateError } = await supabase
        .from('funding_invoices')
        .update({
          google_drive_url: googleDocUrl,
          pdf_url: previewUrl,
        })
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Failed to update invoice with Google Drive URL:', updateError);
      } else {
        console.log('Successfully updated invoice with Google Drive URL');
      }
    }

    console.log('Funding invoice document created:', googleDocUrl);

    return new Response(
      JSON.stringify({
        success: true,
        documentId: newDocId,
        googleDocUrl,
        previewUrl,
        invoiceNumber,
        companyName,
        projectTitle,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error generating funding invoice PDF:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate funding invoice PDF',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
