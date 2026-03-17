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
      invoiceData,
      documentId,
      invoiceNumber,
      projectId,
      clientId,
      companyName,
      projectReference,
    } = await req.json();

    if (!documentId || !invoiceNumber) {
      throw new Error("Missing required parameters: documentId, invoiceNumber");
    }

    const accessToken = await getServiceAccountToken();

    const exportUrl = `https://www.googleapis.com/drive/v3/files/${documentId}/export?mimeType=application/pdf`;
    const exportResponse = await fetch(exportUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!exportResponse.ok) {
      const error = await exportResponse.text();
      throw new Error(`Failed to export document as PDF: ${error}`);
    }

    const pdfBuffer = await exportResponse.arrayBuffer();

    const invoiceDate = invoiceData?.issueDate ? new Date(invoiceData.issueDate) : new Date();
    const datePrefix = invoiceDate.getFullYear().toString() +
      (invoiceDate.getMonth() + 1).toString().padStart(2, '0') +
      invoiceDate.getDate().toString().padStart(2, '0');
    const fileName = `${datePrefix}_${invoiceNumber}_${companyName || 'Invoice'}.pdf`;

    const { data: folderSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'funding_invoice_folder_id')
      .maybeSingle();

    const uploadFolderId = folderSettings?.value;

    const metadata: Record<string, any> = {
      name: fileName,
      mimeType: 'application/pdf',
    };

    if (uploadFolderId) {
      metadata.parents = [uploadFolderId];
    }

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }));

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Failed to upload PDF to Drive: ${error}`);
    }

    const uploadResult = await uploadResponse.json();
    const driveFileUrl = `https://drive.google.com/file/d/${uploadResult.id}/view`;

    const { data: insertedInvoice, error: dbError } = await supabase
      .from('funding_invoice')
      .insert({
        project_id: projectId || null,
        client_id: clientId || null,
        invoice_number: invoiceNumber,
        issue_date: invoiceData?.issueDate || null,
        due_date: invoiceData?.dueDate || null,
        payment_status: invoiceData?.paymentStatus || 'Unpaid',
        amount: parseFloat(invoiceData?.amount) || 0,
        project_reference: projectReference || null,
        company_name: companyName || null,
        payment_method: invoiceData?.paymentMethod || null,
        payment_type: invoiceData?.paymentType || null,
        remark: invoiceData?.remark || null,
        google_drive_url: driveFileUrl,
        issued_company: invoiceData?.issuedCompany || 'Amazing Channel (HK) Limited',
        category: invoiceData?.category || null,
        google_doc_url: `https://docs.google.com/document/d/${documentId}/edit`,
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Failed to save invoice record: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: insertedInvoice.id,
        driveFileUrl,
        invoiceNumber,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error finalizing funding invoice:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to finalize funding invoice' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
