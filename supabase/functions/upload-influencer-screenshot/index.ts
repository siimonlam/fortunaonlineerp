import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

async function getAccessToken(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('email', 'admin@example.com')
    .single();

  if (error || !data) {
    throw new Error('No OAuth token found');
  }

  if (new Date(data.expires_at) <= new Date()) {
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
        refresh_token: data.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResponse.ok) {
      throw new Error('Failed to refresh access token');
    }

    const tokenData = await refreshResponse.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    await supabase
      .from('google_oauth_tokens')
      .update({
        access_token: tokenData.access_token,
        expires_at: newExpiresAt,
      })
      .eq('email', 'admin@example.com');

    return tokenData.access_token;
  }

  return data.access_token;
}

async function ensureKOLFolder(projectFolderId: string, accessToken: string): Promise<string> {
  const searchQuery = `'${projectFolderId}' in parents and name='marketing' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const searchResponse = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchResponse.ok) {
    throw new Error('Failed to search for marketing folder');
  }

  const searchData = await searchResponse.json();
  let marketingFolderId: string;

  if (searchData.files && searchData.files.length > 0) {
    marketingFolderId = searchData.files[0].id;
  } else {
    const createResponse = await fetch(`${GOOGLE_DRIVE_API}/files?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'marketing',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [projectFolderId],
      }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create marketing folder');
    }

    const createData = await createResponse.json();
    marketingFolderId = createData.id;
  }

  const kolSearchQuery = `'${marketingFolderId}' in parents and name='KOL Program' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const kolSearchResponse = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(kolSearchQuery)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!kolSearchResponse.ok) {
    throw new Error('Failed to search for KOL Program folder');
  }

  const kolSearchData = await kolSearchResponse.json();

  if (kolSearchData.files && kolSearchData.files.length > 0) {
    return kolSearchData.files[0].id;
  } else {
    const createKOLResponse = await fetch(`${GOOGLE_DRIVE_API}/files?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'KOL Program',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [marketingFolderId],
      }),
    });

    if (!createKOLResponse.ok) {
      throw new Error('Failed to create KOL Program folder');
    }

    const createKOLData = await createKOLResponse.json();
    return createKOLData.id;
  }
}

async function getNextScreenshotNumber(kolFolderId: string, collaboratorName: string, postDate: string, accessToken: string): Promise<number> {
  const datePrefix = postDate.replace(/-/g, '');
  const namePrefix = `${datePrefix}-${collaboratorName}`;

  const searchQuery = `'${kolFolderId}' in parents and name contains '${namePrefix}' and trashed=false`;

  const searchResponse = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(searchQuery)}&fields=files(name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchResponse.ok) {
    return 1;
  }

  const searchData = await searchResponse.json();
  const files = searchData.files || [];

  if (files.length === 0) {
    return 1;
  }

  const numbers = files.map((file: any) => {
    const match = file.name.match(/-(\d{3})\./);
    return match ? parseInt(match[1]) : 0;
  });

  return Math.max(...numbers) + 1;
}

async function uploadImageToDrive(
  base64Image: string,
  filename: string,
  folderId: string,
  accessToken: string
): Promise<{ fileId: string; webViewLink: string }> {
  const base64Data = base64Image.split(',')[1];
  const mimeType = base64Image.split(',')[0].match(/:(.*?);/)?.[1] || 'image/png';

  const imageData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  const metadata = {
    name: filename,
    mimeType: mimeType,
    parents: [folderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataString = JSON.stringify(metadata);
  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadataString +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Data +
    closeDelimiter;

  const uploadResponse = await fetch(
    `${GOOGLE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload image: ${error}`);
  }

  const data = await uploadResponse.json();
  return {
    fileId: data.id,
    webViewLink: data.webViewLink,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { collaborationId, projectFolderId, collaboratorName, postDate, imageData } = await req.json();

    if (!collaborationId || !projectFolderId || !collaboratorName || !imageData) {
      throw new Error('Missing required fields');
    }

    const accessToken = await getAccessToken(supabaseClient);

    const kolFolderId = await ensureKOLFolder(projectFolderId, accessToken);

    const effectiveDate = postDate || new Date().toISOString().split('T')[0];
    const dateForFilename = effectiveDate.replace(/-/g, '');

    const screenshotNumber = await getNextScreenshotNumber(kolFolderId, collaboratorName, effectiveDate, accessToken);
    const paddedNumber = screenshotNumber.toString().padStart(3, '0');

    const extension = imageData.startsWith('data:image/png') ? 'png' :
                      imageData.startsWith('data:image/jpeg') ? 'jpg' :
                      imageData.startsWith('data:image/jpg') ? 'jpg' : 'png';

    const filename = `${dateForFilename}-${collaboratorName}-${paddedNumber}.${extension}`;

    const { fileId, webViewLink } = await uploadImageToDrive(imageData, filename, kolFolderId, accessToken);

    const { data: currentCollab } = await supabaseClient
      .from('marketing_influencer_collaborations')
      .select('screenshots')
      .eq('id', collaborationId)
      .single();

    const screenshots = currentCollab?.screenshots || [];
    screenshots.push({
      drive_url: webViewLink,
      file_id: fileId,
      filename: filename,
      uploaded_at: new Date().toISOString(),
    });

    const { error: updateError } = await supabaseClient
      .from('marketing_influencer_collaborations')
      .update({ screenshots })
      .eq('id', collaborationId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        screenshot: {
          drive_url: webViewLink,
          file_id: fileId,
          filename: filename,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
