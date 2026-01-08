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

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
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

  // Import the private key
  // Handle both escaped newlines (\n) and actual newlines
  let cleanedKey = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "") // Remove escaped newlines
    .replace(/\n/g, "")  // Remove actual newlines
    .replace(/\s/g, ""); // Remove all whitespace

  let binaryKey: Uint8Array;
  try {
    binaryKey = Uint8Array.from(atob(cleanedKey), c => c.charCodeAt(0));
  } catch (e) {
    console.error("Failed to decode private key:", e);
    throw new Error("Invalid private key format. Please ensure the key is properly base64 encoded.");
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

  const signatureBytes = new Uint8Array(signatureBuffer);
  let signatureBinary = '';
  const sigChunkSize = 8192;
  for (let i = 0; i < signatureBytes.length; i += sigChunkSize) {
    const chunk = signatureBytes.subarray(i, Math.min(i + sigChunkSize, signatureBytes.length));
    signatureBinary += String.fromCharCode(...chunk);
  }
  const signature = btoa(signatureBinary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
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

async function listDriveFiles(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents)&orderBy=folder,name&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list files: ${error}`);
  }

  const data = await response.json();
  return data.files || [];
}

async function getFileMetadata(fileId: string, accessToken: string): Promise<DriveFile> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents&supportsAllDrives=true`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get file metadata: ${error}`);
  }

  return await response.json();
}

async function downloadFile(fileId: string, accessToken: string): Promise<Response> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to download file: ${error}`);
  }

  return response;
}

async function createFolder(folderName: string, parentId: string, accessToken: string): Promise<DriveFile> {
  const url = `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create folder: ${error}`);
  }

  return await response.json();
}

async function uploadFile(fileName: string, parentId: string, fileData: Uint8Array, mimeType: string, accessToken: string): Promise<DriveFile> {
  const metadata = {
    name: fileName,
    parents: [parentId],
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < fileData.length; i += chunkSize) {
    const chunk = fileData.subarray(i, Math.min(i + chunkSize, fileData.length));
    binary += String.fromCharCode(...chunk);
  }
  const base64Data = btoa(binary);

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    base64Data +
    closeDelimiter;

  const url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file: ${error}`);
  }

  return await response.json();
}

async function deleteFile(fileId: string, accessToken: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete file: ${error}`);
  }
}

async function renameFile(fileId: string, newName: string, accessToken: string): Promise<DriveFile> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: newName,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to rename file: ${error}`);
  }

  return await response.json();
}

async function moveFile(fileId: string, newParentId: string, accessToken: string): Promise<DriveFile> {
  const metadata = await getFileMetadata(fileId, accessToken);
  const oldParents = metadata.parents?.join(",") || "";

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${oldParents}&supportsAllDrives=true`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to move file: ${error}`);
  }

  return await response.json();
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
    const action = url.searchParams.get("action") || "list";
    const folderId = url.searchParams.get("folderId");
    const fileId = url.searchParams.get("fileId");

    const accessToken = await getServiceAccountToken();

    if (action === "list" && folderId) {
      const files = await listDriveFiles(folderId, accessToken);
      return new Response(JSON.stringify({ files }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "metadata" && fileId) {
      const metadata = await getFileMetadata(fileId, accessToken);
      return new Response(JSON.stringify(metadata), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download" && fileId) {
      const fileResponse = await downloadFile(fileId, accessToken);
      const blob = await fileResponse.blob();

      return new Response(blob, {
        headers: {
          ...corsHeaders,
          "Content-Type": fileResponse.headers.get("Content-Type") || "application/octet-stream",
          "Content-Disposition": fileResponse.headers.get("Content-Disposition") || "attachment",
        },
      });
    }

    if (action === "createFolder" && req.method === "POST") {
      const body = await req.json();
      const { folderName, parentId } = body;
      
      if (!folderName || !parentId) {
        return new Response(
          JSON.stringify({ error: "folderName and parentId are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const folder = await createFolder(folderName, parentId, accessToken);
      return new Response(JSON.stringify({ folder }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upload" && req.method === "POST") {
      try {
        const body = await req.json();
        const { fileName, parentId, fileData, mimeType } = body;

        console.log(`Upload request for file: ${fileName}, size: ${fileData?.length || 0} bytes (base64)`);

        if (!fileName || !parentId || !fileData || !mimeType) {
          console.error("Missing required parameters:", { fileName: !!fileName, parentId: !!parentId, fileData: !!fileData, mimeType: !!mimeType });
          return new Response(
            JSON.stringify({ error: "fileName, parentId, fileData, and mimeType are required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        let fileDataBytes: Uint8Array;
        try {
          fileDataBytes = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
          console.log(`Decoded file data: ${fileDataBytes.length} bytes`);
        } catch (decodeError) {
          console.error("Failed to decode base64 file data:", decodeError);
          throw new Error(`Failed to decode file data: ${decodeError.message}`);
        }

        const file = await uploadFile(fileName, parentId, fileDataBytes, mimeType, accessToken);
        console.log(`Successfully uploaded file: ${fileName}`);
        return new Response(JSON.stringify({ file }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }
    }

    if (action === "delete" && req.method === "DELETE" && fileId) {
      await deleteFile(fileId, accessToken);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "rename" && req.method === "PATCH" && fileId) {
      const body = await req.json();
      const { newName } = body;
      
      if (!newName) {
        return new Response(
          JSON.stringify({ error: "newName is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const file = await renameFile(fileId, newName, accessToken);
      return new Response(JSON.stringify({ file }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "move" && req.method === "PATCH" && fileId) {
      const body = await req.json();
      const { newParentId } = body;
      
      if (!newParentId) {
        return new Response(
          JSON.stringify({ error: "newParentId is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const file = await moveFile(fileId, newParentId, accessToken);
      return new Response(JSON.stringify({ file }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action or missing parameters" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});