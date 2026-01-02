import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    scope: "https://www.googleapis.com/auth/drive",
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

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function downloadFileFromDrive(fileId: string, accessToken: string): Promise<{ content: string; filename: string; mimeType: string }> {
  const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType&supportsAllDrives=true`;

  const metadataResponse = await fetch(metadataUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!metadataResponse.ok) {
    throw new Error(`Failed to get file metadata: ${await metadataResponse.text()}`);
  }

  const metadata = await metadataResponse.json();

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${await response.text()}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const content = btoa(String.fromCharCode(...uint8Array));

  return {
    content,
    filename: metadata.name,
    mimeType: metadata.mimeType,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    const { data: pendingEmails, error: fetchError } = await supabase
      .from('scheduled_emails')
      .select('*')
      .eq('status', 'pending')
      .or(`send_immediately.eq.true,scheduled_date.lte.${now}`)
      .order('scheduled_date', { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending emails to process', processed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];

    for (const email of pendingEmails) {
      try {
        const { data: emailAccount, error: accountError } = await supabase
          .from('email_accounts')
          .select('smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, smtp_from_email, smtp_from_name')
          .eq('id', email.from_account_id)
          .single();

        if (accountError || !emailAccount) {
          throw new Error(`Email account not found: ${accountError?.message || 'Unknown error'}`);
        }

        const smtpSettings = {
          smtp_host: emailAccount.smtp_host,
          smtp_port: emailAccount.smtp_port.toString(),
          smtp_secure: emailAccount.smtp_secure.toString(),
          smtp_user: emailAccount.smtp_user,
          smtp_password: emailAccount.smtp_password,
          smtp_from_email: emailAccount.smtp_from_email,
          smtp_from_name: emailAccount.smtp_from_name,
        };

        const attachments: any[] = [];

        if (email.attachment_type === 'google_drive' && email.attachment_ids && email.attachment_ids.length > 0) {
          const accessToken = await getServiceAccountToken();

          for (const fileId of email.attachment_ids) {
            try {
              const file = await downloadFileFromDrive(fileId, accessToken);
              attachments.push({
                filename: file.filename,
                content: file.content,
                encoding: 'base64',
                contentType: file.mimeType,
              });
            } catch (error) {
              console.error(`Failed to download file ${fileId}:`, error);
            }
          }
        } else if (email.attachment_type === 'share_resource' && email.attachment_ids && email.attachment_ids.length > 0) {
          for (const resourceId of email.attachment_ids) {
            try {
              const { data: resource } = await supabase
                .from('share_resources')
                .select('title, file_path')
                .eq('id', resourceId)
                .single();

              if (resource && resource.file_path) {
                const { data: fileData } = await supabase.storage
                  .from('share-resources')
                  .download(resource.file_path);

                if (fileData) {
                  const arrayBuffer = await fileData.arrayBuffer();
                  const uint8Array = new Uint8Array(arrayBuffer);
                  const content = btoa(String.fromCharCode(...uint8Array));

                  const mimeType = fileData.type || 'application/octet-stream';
                  const filename = resource.title || 'attachment';
                  const finalFilename = filename.includes('.') ? filename : `${filename}.pdf`;

                  attachments.push({
                    filename: finalFilename,
                    content: content,
                    encoding: 'base64',
                    contentType: mimeType,
                  });
                }
              }
            } catch (error) {
              console.error(`Failed to download share resource ${resourceId}:`, error);
            }
          }
        }

        const emailFunctionUrl = `${supabaseUrl}/functions/v1/send-smtp-email`;

        const response = await fetch(emailFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            to: email.recipient_emails,
            subject: email.subject,
            body: email.body,
            html: false,
            smtpSettings: smtpSettings,
            attachments: attachments,
          }),
        });

        const result = await response.json();

        if (result.success) {
          await supabase
            .from('scheduled_emails')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', email.id);

          results.push({ id: email.id, status: 'sent' });
        } else {
          await supabase
            .from('scheduled_emails')
            .update({
              status: 'failed',
              error_message: result.error || 'Unknown error',
            })
            .eq('id', email.id);

          results.push({ id: email.id, status: 'failed', error: result.error });
        }
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);

        await supabase
          .from('scheduled_emails')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', email.id);

        results.push({ id: email.id, status: 'failed', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} emails`,
        processed: results.length,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error processing scheduled emails:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
