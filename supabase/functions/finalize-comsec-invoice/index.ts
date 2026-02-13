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
  const serviceAccountEmail = "goldwinerp@woven-answer-485106-u8.iam.gserviceaccount.com";
  const privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_COMSEC");

  if (!privateKey) {
    throw new Error("Service account private key not configured for comsec");
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
    const { invoiceId, documentId, invoiceNumber } = await req.json();

    if (!invoiceId || !documentId || !invoiceNumber) {
      throw new Error("Missing required parameters: invoiceId, documentId, invoiceNumber");
    }

    console.log('Finalizing invoice:', { invoiceId, documentId, invoiceNumber });

    // Get service account token
    const accessToken = await getServiceAccountToken();

    // Export Google Doc as PDF
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${documentId}/export?mimeType=application/pdf`;

    const exportResponse = await fetch(exportUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!exportResponse.ok) {
      const error = await exportResponse.text();
      throw new Error(`Failed to export document as PDF: ${error}`);
    }

    const pdfBuffer = await exportResponse.arrayBuffer();
    console.log('PDF exported, size:', pdfBuffer.byteLength, 'bytes');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upload PDF to Supabase Storage
    const filePath = `invoices/${invoiceNumber}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('comsec-documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    console.log('PDF uploaded to storage:', filePath);

    // Get public URL for the PDF
    const { data: urlData } = supabase.storage
      .from('comsec-documents')
      .getPublicUrl(filePath);

    // Update invoice record
    const { error: updateError } = await supabase
      .from('comsec_invoices')
      .update({
        status: 'Unpaid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`);
    }

    console.log('Invoice status updated to Unpaid');

    return new Response(
      JSON.stringify({
        success: true,
        pdfPath: filePath,
        pdfUrl: urlData.publicUrl,
        invoiceNumber,
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
    console.error('Error finalizing invoice:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to finalize invoice',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
