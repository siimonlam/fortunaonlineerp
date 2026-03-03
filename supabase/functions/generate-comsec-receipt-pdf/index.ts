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

function extractDocIdFromUrl(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return url;
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
      receiptNumber,
      clientName,
      clientAddress,
      clientContact,
      clientPhone,
      receiptDate,
      amount,
      paymentMethod,
      paymentReference,
      invoiceNumber,
      remarks,
      companyCode,
    } = await req.json();

    console.log('Generating receipt PDF for:', clientName);

    const { data: templateSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'comsec_receipt_template_url')
      .maybeSingle();

    const templateUrl = templateSettings?.value;

    if (!templateUrl) {
      return new Response(
        JSON.stringify({ error: 'Receipt template not configured. Please set comsec_receipt_template_url in system settings.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const templateDocId = extractDocIdFromUrl(templateUrl);
    const accessToken = await getServiceAccountToken();

    const receiptFolderId = '13RVRV1SWVsUcG6vMre_DrouWIVbsGF99';

    // Retry logic for copy operation with exponential backoff
    let copyData: any;
    let newDocId: string;
    let copyAttempts = 0;
    const maxCopyAttempts = 3;

    while (copyAttempts < maxCopyAttempts) {
      try {
        const copyResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${templateDocId}/copy?supportsAllDrives=true`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `${receiptNumber} - ${clientName}`,
            parents: [receiptFolderId],
          }),
        });

        if (copyResponse.ok) {
          copyData = await copyResponse.json();
          newDocId = copyData.id;
          console.log('Successfully copied template on attempt:', copyAttempts + 1);
          break;
        }

        const errorText = await copyResponse.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        // Check if it's a rate limit error
        if (copyResponse.status === 403 && errorData.error?.errors?.[0]?.reason === 'userRateLimitExceeded') {
          copyAttempts++;
          if (copyAttempts < maxCopyAttempts) {
            const backoffDelay = Math.pow(2, copyAttempts) * 1000; // Exponential backoff: 2s, 4s, 8s
            console.log(`Rate limit hit, waiting ${backoffDelay}ms before retry ${copyAttempts + 1}/${maxCopyAttempts}`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          }
        }

        throw new Error(`Failed to copy template: ${JSON.stringify(errorData)}`);
      } catch (error) {
        if (copyAttempts >= maxCopyAttempts - 1) {
          throw error;
        }
        copyAttempts++;
        const backoffDelay = Math.pow(2, copyAttempts) * 1000;
        console.log(`Error copying template, retrying in ${backoffDelay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    if (!newDocId) {
      throw new Error('Failed to copy template after multiple attempts');
    }

    console.log('Created copy of template:', newDocId);

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
      throw new Error(`Template must be a Google Doc, but got: ${fileMetadata.mimeType}`);
    }

    const formattedAmount = parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const formattedDate = new Date(receiptDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const requests = [
      {
        replaceAllText: {
          containsText: { text: '{RECEIPT_NUMBER}', matchCase: false },
          replaceText: receiptNumber,
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{RECEIPT_DATE}', matchCase: false },
          replaceText: formattedDate,
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{CLIENT_NAME}', matchCase: false },
          replaceText: clientName,
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{CLIENT_ADDRESS}', matchCase: false },
          replaceText: clientAddress || '',
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{CLIENT_CONTACT}', matchCase: false },
          replaceText: '',
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{CLIENT_PHONE}', matchCase: false },
          replaceText: '',
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{AMOUNT}', matchCase: false },
          replaceText: formattedAmount,
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{PAYMENT_METHOD}', matchCase: false },
          replaceText: paymentMethod || '',
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{PAYMENT_REFERENCE}', matchCase: false },
          replaceText: paymentReference || '',
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{INVOICE_NUMBER}', matchCase: false },
          replaceText: invoiceNumber || '',
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{REMARKS}', matchCase: false },
          replaceText: remarks || '',
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{COMPANY_CODE}', matchCase: false },
          replaceText: companyCode || '',
        },
      },
    ];

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

    console.log('Updated document with receipt data');

    const googleDocUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
    const previewUrl = `https://docs.google.com/document/d/${newDocId}/preview`;

    console.log('Receipt document created:', googleDocUrl);

    return new Response(
      JSON.stringify({
        success: true,
        documentId: newDocId,
        googleDocUrl,
        previewUrl,
        receiptNumber,
        clientName,
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
    console.error('Error generating receipt PDF:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate receipt PDF',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
