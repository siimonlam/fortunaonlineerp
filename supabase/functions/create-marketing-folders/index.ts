import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const PARENT_FOLDER_ID = '1x4YWlwk-VCufzdnpt7SO3u_-03WdbmWp';
const TEMPLATE_FOLDER_ID = '1IHAmnsXhnosqm19c2wUtVrptpHQnkZJD';

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
    throw new Error(`Failed to create folder: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

async function copyFolderStructure(
  sourceFolderId: string,
  targetParentId: string,
  accessToken: string,
  folderMap: Map<string, string> = new Map()
): Promise<Map<string, string>> {
  const listResponse = await fetch(
    `${GOOGLE_DRIVE_API}/files?q='${sourceFolderId}'+in+parents&fields=files(id,name,mimeType)&pageSize=1000`,
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
  const files = listData.files || [];

  for (const file of files) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      const newFolderId = await createGoogleDriveFolder(file.name, targetParentId, accessToken);
      folderMap.set(file.name, newFolderId);
      await copyFolderStructure(file.id, newFolderId, accessToken, folderMap);
    }
  }

  return folderMap;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { projectId, companyName } = await req.json();

    if (!projectId || !companyName) {
      return new Response(
        JSON.stringify({ error: 'Project ID and company name are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokenData, error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve Google OAuth token' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      const refreshResponse = await fetch(`${supabaseUrl}/functions/v1/google-oauth-refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: tokenData.refresh_token }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh access token');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
    }

    console.log(`Creating folder structure for: ${companyName}`);

    const rootFolderId = await createGoogleDriveFolder(companyName, PARENT_FOLDER_ID, accessToken);
    console.log(`Root folder created: ${rootFolderId}`);

    const folderMap = new Map<string, string>();
    folderMap.set(companyName, rootFolderId);

    console.log('Copying folder structure from template...');
    await copyFolderStructure(TEMPLATE_FOLDER_ID, rootFolderId, accessToken, folderMap);

    console.log(`Folder structure created successfully`);

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
