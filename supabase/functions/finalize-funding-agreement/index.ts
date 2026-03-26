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
      documentId,
      agreementNumber,
      projectId,
      clientId,
      companyName,
      projectReference,
      agreementData,
    } = await req.json();

    console.log('Finalizing agreement:', agreementNumber);

    const accessToken = await getServiceAccountToken();

    const exportUrl = `https://www.googleapis.com/drive/v3/files/${documentId}/export?mimeType=application/pdf`;
    const exportResponse = await fetch(exportUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!exportResponse.ok) {
      const error = await exportResponse.text();
      throw new Error(`Failed to export PDF: ${error}`);
    }

    const pdfBlob = await exportResponse.blob();
    const pdfBuffer = await pdfBlob.arrayBuffer();
    const pdfUint8Array = new Uint8Array(pdfBuffer);

    const fileName = `${agreementNumber}.pdf`;
    const filePath = `agreements/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(filePath, pdfUint8Array, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload PDF to storage: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('client-documents')
      .getPublicUrl(filePath);

    const googleDocUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    const { error: dbError } = await supabase
      .from('funding_agreements')
      .insert({
        project_id: projectId,
        agreement_number: agreementNumber,
        client_name: companyName,
        project_name: agreementData?.projectName || projectReference,
        project_size: agreementData?.projectSize ? Number(agreementData.projectSize) : null,
        funding_ratio: agreementData?.fundingRatio || null,
        approved_amount: agreementData?.approvedAmount ? Number(agreementData.approvedAmount) : null,
        estimated_start_date: agreementData?.estimatedStartDate || null,
        estimated_end_date: agreementData?.estimatedEndDate || null,
        google_drive_url: googleDocUrl,
        pdf_url: publicUrl,
        created_by: userId,
      });

    if (dbError) {
      console.error('Error saving agreement to database:', dbError);
      throw new Error(`Failed to save agreement to database: ${dbError.message}`);
    }

    console.log('Agreement finalized successfully');
    console.log('PDF URL:', publicUrl);
    console.log('Google Doc URL:', googleDocUrl);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl: publicUrl,
        googleDocUrl,
        agreementNumber,
        companyName,
        projectReference,
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
    console.error('Error finalizing agreement:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to finalize agreement',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
