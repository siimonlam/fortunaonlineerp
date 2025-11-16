import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const TEMPLATE_FOLDER_ID = '17EK9t8ACTyghhklCf84TZ9Y5CyYdJHbk';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

async function copyFolder(
  sourceFolderId: string,
  parentFolderId: string,
  folderName: string,
  accessToken: string
): Promise<{ folderId: string; folderMap: Record<string, string> }> {
  const folderMap: Record<string, string> = {};

  console.log(`Creating folder: ${folderName}`);
  const newFolderId = await createGoogleDriveFolder(folderName, parentFolderId, accessToken);
  folderMap[''] = newFolderId;

  await copyFolderContents(sourceFolderId, newFolderId, '', folderMap, accessToken);

  return { folderId: newFolderId, folderMap };
}

async function copyFolderContents(
  sourceFolderId: string,
  targetFolderId: string,
  currentPath: string,
  folderMap: Record<string, string>,
  accessToken: string
): Promise<void> {
  console.log(`Listing items in source folder: ${sourceFolderId}, path: ${currentPath || 'root'}`);
  const items = await listFilesInFolder(sourceFolderId, accessToken);
  console.log(`Found ${items.length} items in ${currentPath || 'root'}`);

  for (const item of items) {
    try {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        console.log(`Creating subfolder: ${newPath}`);

        const newFolderId = await createGoogleDriveFolder(item.name, targetFolderId, accessToken);
        folderMap[newPath] = newFolderId;
        console.log(`Created subfolder ${newPath} with ID: ${newFolderId}`);

        await copyFolderContents(item.id, newFolderId, newPath, folderMap, accessToken);

        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        console.log(`Copying file: ${item.name} to folder ${targetFolderId}`);
        await copyFile(item.id, targetFolderId, accessToken);
        console.log(`Copied file ${item.name}`);

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error(`Error copying ${item.name}:`, error);
    }
  }
}

async function listFilesInFolder(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list files in folder: ${error}`);
  }

  const data = await response.json();
  return data.files || [];
}

async function copyFile(
  fileId: string,
  targetFolderId: string,
  accessToken: string
): Promise<string> {
  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files/${fileId}/copy`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parents: [targetFolderId],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to copy file: ${error}`);
  }

  const data = await response.json();
  const newFileId = data.id;

  try {
    await fetch(
      `${GOOGLE_DRIVE_API}/files/${newFileId}/permissions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'anyone',
        }),
      }
    );
  } catch (err) {
    console.warn(`Failed to share file ${newFileId}:`, err);
  }

  return newFileId;
}

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

  const response = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create folder "${name}": ${error}`);
  }

  const data = await response.json();
  const folderId = data.id;

  try {
    await fetch(
      `${GOOGLE_DRIVE_API}/files/${folderId}/permissions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'anyone',
        }),
      }
    );
    console.log(`Shared folder "${name}" with anyone who has the link`);
  } catch (err) {
    console.warn(`Failed to share folder "${name}":`, err);
  }

  return folderId;
}

async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured in environment');
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { project_id, project_name, project_reference } = await req.json();

    console.log('Creating BUD folders for project:', project_id, project_name);

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: 'project_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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

    let access_token = credentials.access_token;
    const token_expires_at = new Date(credentials.token_expires_at);
    const now = new Date();

    if (token_expires_at < new Date(now.getTime() + 5 * 60 * 1000)) {
      console.log('Access token expired, refreshing...');
      access_token = await refreshGoogleToken(credentials.refresh_token);

      const new_expires_at = new Date(now.getTime() + 3600 * 1000);
      await supabase
        .from('google_oauth_credentials')
        .update({
          access_token: access_token,
          token_expires_at: new_expires_at.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('service_name', 'google_drive');

      console.log('Token refreshed successfully');
    }

    const parent_folder_id = '1UGe0xaW7Z-PIFhK9CHLayI78k59HjQ-n';

    const rootFolderName = project_reference
      ? `${project_reference} - ${project_name || 'Unnamed Project'}`
      : project_name || `Project ${project_id}`;

    console.log('Copying template folder to create:', rootFolderName);

    const testResponse = await fetch(
      `${GOOGLE_DRIVE_API}/files/${TEMPLATE_FOLDER_ID}?fields=id,name,mimeType`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      }
    );

    if (!testResponse.ok) {
      const error = await testResponse.text();
      console.error('Cannot access template folder:', error);
      throw new Error(`Cannot access template folder. Error: ${error}`);
    }

    const { folderId: rootFolderId, folderMap } = await copyFolder(
      TEMPLATE_FOLDER_ID,
      parent_folder_id,
      rootFolderName,
      access_token
    );

    console.log('Folder structure copied successfully');
    console.log('Total folders created:', Object.keys(folderMap).length);

    const { error: dbError } = await supabase.from('project_folders').insert({
      project_id,
      parent_folder_id: rootFolderId,
      folder_structure: folderMap,
      status: 'completed',
      error_message: null,
    });

    if (dbError) {
      console.error('Error saving folder structure to database:', dbError);
    }

    const driveUrl = `https://drive.google.com/drive/folders/${rootFolderId}`;

    const response = {
      success: true,
      root_folder_id: rootFolderId,
      drive_url: driveUrl,
      folders_created: Object.keys(folderMap).length,
      folder_map: folderMap,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create-bud-folders function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
