import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const PARENT_FOLDER_ID = '0AKtw1OOFlpHcUk9PVA';
const TEMPLATE_FOLDER_ID = '1ra4uNP1zPWnX2ZsY6TQ24Vz8j98rPrTO';

async function createGoogleDriveFolder(
  name: string,
  parentId: string | null,
  accessToken: string
): Promise<string> {
  const metadata = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentId && { parents: [parentId] }),
  };

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create folder: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

async function copyFile(
  fileId: string,
  targetParentId: string,
  accessToken: string
): Promise<void> {
  const copyResponse = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}/copy?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parents: [targetParentId],
    }),
  });

  if (!copyResponse.ok) {
    const error = await copyResponse.text();
    throw new Error(`Failed to copy file: ${error}`);
  }
}

async function copyFolderStructure(
  sourceFolderId: string,
  targetParentId: string,
  accessToken: string,
  folderMap: Map<string, string> = new Map()
): Promise<Map<string, string>> {
  const listResponse = await fetch(
    `${GOOGLE_DRIVE_API}/files?q='${sourceFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'&fields=files(id,name,mimeType)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!listResponse.ok) {
    throw new Error('Failed to list folder contents');
  }

  const listData = await listResponse.json();
  const folders = listData.files || [];

  console.log(`Found ${folders.length} folders in ${sourceFolderId}:`, folders.map(f => f.name));

  for (const folder of folders) {
    if (folder.mimeType === 'application/vnd.google-apps.folder') {
      const newFolderId = await createGoogleDriveFolder(folder.name, targetParentId, accessToken);
      folderMap.set(folder.name, newFolderId);
      await copyFolderStructure(folder.id, newFolderId, accessToken, folderMap);
    }
  }

  return folderMap;
}

async function copyTemplateFiles(
  sourceFolderId: string,
  targetFolderId: string,
  accessToken: string
): Promise<void> {
  const listResponse = await fetch(
    `${GOOGLE_DRIVE_API}/files?q='${sourceFolderId}'+in+parents+and+mimeType!='application/vnd.google-apps.folder'&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!listResponse.ok) {
    throw new Error('Failed to list template files');
  }

  const listData = await listResponse.json();
  const files = listData.files || [];

  console.log(`Found ${files.length} template files to copy:`, files.map(f => f.name));

  for (const file of files) {
    console.log(`Copying file: ${file.name}`);
    await copyFile(file.id, targetFolderId, accessToken);
  }
}

async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!refreshResponse.ok) {
    const error = await refreshResponse.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const refreshData = await refreshResponse.json();
  return refreshData.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const requestBody = await req.json();
    console.log('Received request body:', requestBody);

    const { projectId, marketingReference, brandName, companyName } = requestBody;

    console.log('Extracted values:', {
      projectId,
      marketingReference,
      brandName,
      companyName,
      hasProjectId: !!projectId,
      hasMarketingReference: !!marketingReference
    });

    if (!projectId || !marketingReference) {
      console.error('Missing required fields:', { projectId, marketingReference });
      return new Response(
        JSON.stringify({ error: 'Project ID and marketing reference are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const folderName = `${brandName || companyName || 'Unnamed'} - ${marketingReference}`;
    console.log(`Creating folder: ${folderName}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: credentials, error: credError } = await supabase
      .from('google_oauth_credentials')
      .select('*')
      .eq('service_name', 'google_drive')
      .maybeSingle();

    if (credError || !credentials) {
      console.error('Failed to fetch OAuth credentials:', credError);
      return new Response(
        JSON.stringify({ error: 'Google Drive not connected. Please authorize Google Drive in Settings.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let accessToken = credentials.access_token;
    const tokenExpiresAt = new Date(credentials.token_expires_at);
    const now = new Date();

    if (tokenExpiresAt < new Date(now.getTime() + 5 * 60 * 1000)) {
      console.log('Access token expired, refreshing...');
      accessToken = await refreshGoogleToken(credentials.refresh_token);

      const newExpiresAt = new Date(now.getTime() + 3600 * 1000);
      await supabase
        .from('google_oauth_credentials')
        .update({
          access_token: accessToken,
          token_expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('service_name', 'google_drive');

      console.log('Token refreshed successfully');
    }

    console.log(`Creating folder structure for: ${folderName}`);

    const rootFolderId = await createGoogleDriveFolder(folderName, PARENT_FOLDER_ID, accessToken);
    console.log(`Root folder created: ${rootFolderId}`);

    const folderMap = new Map<string, string>();
    folderMap.set(folderName, rootFolderId);

    console.log('Copying folder structure from template...');
    await copyFolderStructure(TEMPLATE_FOLDER_ID, rootFolderId, accessToken, folderMap);

    console.log('Copying template files...');
    await copyTemplateFiles(TEMPLATE_FOLDER_ID, rootFolderId, accessToken);

    console.log(`Folder structure and files created successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        root_folder_id: rootFolderId,
        folder_map: Object.fromEntries(folderMap),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating folders:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});