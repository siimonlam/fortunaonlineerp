import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');
    const format = url.searchParams.get('format') || 'pdf';

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: 'fileId parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Fetching file ${fileId} as ${format}`);

    const accessToken = await getServiceAccountToken();

    // For Google Docs, we need to use the export endpoint
    // The format can be 'pdf', 'docx', 'txt', etc.
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
    };

    const mimeType = mimeTypes[format] || 'application/pdf';

    // Use the Google Drive export endpoint for Google Docs
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}&supportsAllDrives=true`;

    console.log(`Exporting from: ${exportUrl}`);

    const fileResponse = await fetch(exportUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      console.error(`Failed to fetch file: ${fileResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch file from Google Drive',
          details: `${fileResponse.statusText}`,
          fileId,
          status: fileResponse.status
        }),
        {
          status: fileResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const fileBlob = await fileResponse.blob();
    console.log(`Successfully fetched file, size: ${fileBlob.size} bytes`);

    return new Response(fileBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileId}.${format}"`,
      },
    });

  } catch (error: any) {
    console.error('Error serving drive file:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to serve drive file',
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
