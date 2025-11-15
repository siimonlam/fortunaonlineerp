import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_API_KEY = 'AIzaSyCaL5l3z5Lpt8_34CuYgsrCjlOQfZegQOg';

// Template folder to copy from
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

  // Create the new folder
  console.log(`Creating folder: ${folderName}`);
  const newFolderId = await createGoogleDriveFolder(folderName, parentFolderId, accessToken);
  folderMap[''] = newFolderId;

  // Recursively copy contents
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
  // List all files and folders in the source folder
  console.log(`Listing items in source folder: ${sourceFolderId}, path: ${currentPath || 'root'}`);
  const items = await listFilesInFolder(sourceFolderId, accessToken);
  console.log(`Found ${items.length} items in ${currentPath || 'root'}`);

  for (const item of items) {
    try {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        // It's a folder - create it and recurse
        const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        console.log(`Creating subfolder: ${newPath}`);

        const newFolderId = await createGoogleDriveFolder(item.name, targetFolderId, accessToken);
        folderMap[newPath] = newFolderId;
        console.log(`Created subfolder ${newPath} with ID: ${newFolderId}`);

        // Recursively copy folder contents
        await copyFolderContents(item.id, newFolderId, newPath, folderMap, accessToken);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // It's a file - copy it
        console.log(`Copying file: ${item.name} to folder ${targetFolderId}`);
        const newFileId = await copyFile(item.id, targetFolderId, accessToken);
        console.log(`Copied file ${item.name}, new ID: ${newFileId}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error copying ${item.name}:`, error);
      console.error('Error details:', error.message, error.stack);
      // Continue with other items even if one fails
    }
  }
}

async function listFilesInFolder(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${GOOGLE_API_KEY}`,
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
    `${GOOGLE_DRIVE_API}/files/${fileId}/copy?key=${GOOGLE_API_KEY}`,
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
  return data.id;
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

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?key=${GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create folder \"${name}\": ${error}`);
  }

  const data = await response.json();
  return data.id;
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
      .single();

    if (credError || !credentials) {
      console.error('Failed to fetch OAuth credentials:', credError);
      return new Response(
        JSON.stringify({ error: 'Google Drive OAuth credentials not configured. Please contact administrator.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let access_token = credentials.access_token;
    const token_expires_at = new Date(credentials.token_expires_at);
    const now = new Date();

    // Check if token is expired or about to expire (within 5 minutes)
    if (token_expires_at < new Date(now.getTime() + 5 * 60 * 1000)) {
      console.log('Access token expired, refreshing...');

      // Refresh the token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: '1030291796653-cac8klgoqmkaqvo0odhcj12g7qhip42e.apps.googleusercontent.com',
          client_secret: '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',
          refresh_token: credentials.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        const error = await refreshResponse.text();
        console.error('Failed to refresh token. Status:', refreshResponse.status, 'Error:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to refresh Google Drive token. Please re-authenticate.',
            details: error,
            status: refreshResponse.status
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const refreshData = await refreshResponse.json();
      access_token = refreshData.access_token;

      // Update the database with new token
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

    // Create root folder name
    const rootFolderName = project_reference
      ? `${project_reference} - ${project_name || 'Unnamed Project'}`
      : project_name || `Project ${project_id}`;

    console.log('Copying template folder to create:', rootFolderName);
    console.log('Template folder ID:', TEMPLATE_FOLDER_ID);

    // First, verify we can access the template folder
    try {
      const testResponse = await fetch(
        `${GOOGLE_DRIVE_API}/files/${TEMPLATE_FOLDER_ID}?fields=id,name,mimeType&key=${GOOGLE_API_KEY}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      );

      if (!testResponse.ok) {
        const error = await testResponse.text();
        console.error('Cannot access template folder. Status:', testResponse.status, 'Error:', error);
        throw new Error(`Cannot access template folder. Please ensure folder ID ${TEMPLATE_FOLDER_ID} is shared with the service account. Error: ${error}`);
      }

      const templateInfo = await testResponse.json();
      console.log('Template folder accessible:', templateInfo);
    } catch (err) {
      console.error('Error accessing template folder:', err);
      throw err;
    }

    // Copy the entire template folder structure
    const { folderId: rootFolderId, folderMap } = await copyFolder(
      TEMPLATE_FOLDER_ID,
      parent_folder_id,
      rootFolderName,
      access_token
    );

    console.log('Folder structure copied successfully');
    console.log('Total folders created:', Object.keys(folderMap).length);

    // Store folder structure in database
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

    const response = {
      success: true,
      root_folder_id: rootFolderId,
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
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
