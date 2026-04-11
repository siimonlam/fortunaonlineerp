import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

async function getServiceAccountToken(): Promise<string> {
  const serviceAccountEmail = "fortunaerp@fortuna-erp.iam.gserviceaccount.com";
  const privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");

  if (!privateKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedClaimSet = btoa(JSON.stringify(claimSet))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const cleanedKey = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\n/g, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(cleanedKey), c => c.charCodeAt(0));

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

  const signatureBytes = new Uint8Array(signatureBuffer);
  let signatureBinary = "";
  const chunkSize = 8192;
  for (let i = 0; i < signatureBytes.length; i += chunkSize) {
    const chunk = signatureBytes.subarray(i, Math.min(i + chunkSize, signatureBytes.length));
    signatureBinary += String.fromCharCode(...chunk);
  }
  const signature = btoa(signatureBinary)
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

async function listDriveFiles(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink)&orderBy=name&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list Drive files: ${error}`);
  }

  const data = await response.json();
  return data.files || [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { checklist_item_id, drive_folder_id } = await req.json();

    if (!checklist_item_id || !drive_folder_id) {
      return new Response(
        JSON.stringify({ error: "checklist_item_id and drive_folder_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getServiceAccountToken();

    const driveFiles = await listDriveFiles(drive_folder_id, accessToken);

    const { data: existingFiles, error: fetchError } = await supabase
      .from("project_checklist_files")
      .select("file_id")
      .eq("checklist_item_id", checklist_item_id)
      .not("file_id", "is", null);

    if (fetchError) throw fetchError;

    const existingFileIds = new Set((existingFiles || []).map((f: { file_id: string }) => f.file_id));

    const newFiles = driveFiles.filter(f => !existingFileIds.has(f.id));

    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    let synced = 0;
    let webhooksSent = 0;

    for (const file of newFiles) {
      const fileUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;

      const { error: insertError } = await supabase
        .from("project_checklist_files")
        .insert({
          checklist_item_id,
          file_id: file.id,
          file_name: file.name,
          file_url: fileUrl,
          is_verified_by_ai: false,
          extracted_data: {},
        });

      if (insertError) {
        console.error(`Failed to insert file ${file.id}:`, insertError);
        continue;
      }

      synced++;

      if (n8nWebhookUrl) {
        try {
          const webhookRes = await fetch(n8nWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_id: file.id,
              file_name: file.name,
              checklist_item_id,
            }),
          });
          if (webhookRes.ok) webhooksSent++;
        } catch (webhookErr) {
          console.error(`Webhook failed for file ${file.id}:`, webhookErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_in_drive: driveFiles.length,
        already_synced: driveFiles.length - newFiles.length,
        new_files_synced: synced,
        webhooks_sent: webhooksSent,
        n8n_configured: !!n8nWebhookUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-checklist-files error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
