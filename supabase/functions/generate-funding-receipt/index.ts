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
    binaryKey = Uint8Array.from(atob(cleanedKey), (c) => c.charCodeAt(0));
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
    throw new Error(`Failed to get service account token: ${error}`);
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
      receiptNumber,
      receiptDate,
      invoiceId,
      invoiceNumber,
      projectId,
      projectReference,
      paymentDate,
      paymentAmount,
      paymentMethod,
      paymentMethodRemark,
      companyName,
      companyNameChinese,
      contactName,
      contactNumber,
      address,
      applicationNumber,
      fundingScheme,
      clientNumber,
      createdBy,
    } = await req.json();

    console.log('Generating funding receipt for:', companyName, receiptNumber);

    const { data: templateSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'funding_receipt_template_doc_id')
      .maybeSingle();

    const templateDocId = templateSettings?.value;

    if (!templateDocId) {
      return new Response(
        JSON.stringify({ error: 'Receipt template not configured. Please set funding_receipt_template_doc_id in system settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: folderSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'funding_receipt_folder_id')
      .maybeSingle();

    const receiptFolderId = folderSettings?.value;

    if (!receiptFolderId) {
      return new Response(
        JSON.stringify({ error: 'Receipt folder not configured. Please set funding_receipt_folder_id in system settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await getServiceAccountToken();

    const copyResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${templateDocId}/copy?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${receiptNumber} - ${companyName || 'Receipt'}`,
          parents: [receiptFolderId],
        }),
      }
    );

    if (!copyResponse.ok) {
      const error = await copyResponse.text();
      throw new Error(`Failed to copy receipt template: ${error}`);
    }

    const copyData = await copyResponse.json();
    const newDocId = copyData.id;

    console.log('Created receipt document copy:', newDocId);

    let fileMetadata: any;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const fileMetadataResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${newDocId}?fields=mimeType,name&supportsAllDrives=true`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!fileMetadataResponse.ok) {
        throw new Error('Failed to verify copied document');
      }

      fileMetadata = await fileMetadataResponse.json();

      if (fileMetadata.mimeType === 'application/vnd.google-apps.document') {
        break;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (fileMetadata.mimeType !== 'application/vnd.google-apps.document') {
      throw new Error(`Template must be a Google Doc, but got: ${fileMetadata.mimeType}`);
    }

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('en-GB');
    };

    const replacements: Record<string, string> = {
      '{{RECEIPT_NUMBER}}': receiptNumber || '',
      '{{RECEIPT_DATE}}': formatDate(receiptDate),
      '{{INVOICE_NUMBER}}': invoiceNumber || '',
      '{{PROJECT_REFERENCE}}': projectReference || '',
      '{{PAYMENT_DATE}}': formatDate(paymentDate),
      '{{PAYMENT_AMOUNT}}': paymentAmount ? `HK$${parseFloat(paymentAmount).toFixed(2)}` : '',
      '{{PAYMENT_AMOUNT_RAW}}': paymentAmount ? parseFloat(paymentAmount).toFixed(2) : '',
      '{{PAYMENT_METHOD}}': paymentMethod || '',
      '{{PAYMENT_METHOD_REMARK}}': paymentMethodRemark || '',
      '{{COMPANY_NAME}}': companyName || '',
      '{{COMPANY_NAME_CHINESE}}': companyNameChinese || '',
      '{{CONTACT_NAME}}': contactName || '',
      '{{CONTACT_NUMBER}}': contactNumber || '',
      '{{ADDRESS}}': address || '',
      '{{APPLICATION_NUMBER}}': applicationNumber || '',
      '{{FUNDING_SCHEME}}': fundingScheme || '',
      '{{CLIENT_NUMBER}}': clientNumber || '',
    };

    const requests = Object.entries(replacements).map(([placeholder, value]) => ({
      replaceAllText: {
        containsText: { text: placeholder, matchCase: true },
        replaceText: String(value),
      },
    }));

    const updateResponse = await fetch(
      `https://docs.googleapis.com/v1/documents/${newDocId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update receipt document: ${error}`);
    }

    console.log('Updated receipt document with data');

    const googleDocUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
    const previewUrl = `https://docs.google.com/document/d/${newDocId}/preview`;

    const { data: receiptRecord, error: insertError } = await supabase
      .from('funding_receipt')
      .insert({
        receipt_number: receiptNumber,
        receipt_date: receiptDate,
        invoice_id: invoiceId || null,
        invoice_number: invoiceNumber,
        project_id: projectId || null,
        project_reference: projectReference || null,
        payment_date: paymentDate || null,
        payment_amount: parseFloat(paymentAmount) || 0,
        payment_method: paymentMethod || null,
        payment_method_remark: paymentMethodRemark || null,
        google_drive_url: googleDocUrl,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save receipt record: ${insertError.message}`);
    }

    console.log('Receipt generated successfully:', receiptRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        receiptId: receiptRecord.id,
        receiptNumber,
        googleDocUrl,
        previewUrl,
        documentId: newDocId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating funding receipt:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate funding receipt' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
