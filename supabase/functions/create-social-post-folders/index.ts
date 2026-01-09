import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';

async function findSubfolder(
  parentId: string,
  folderName: string,
  accessToken: string
): Promise<string | null> {
  const query = `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search for folder: ${error}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

async function createGoogleDriveFolder(
  name: string,
  parentId: string,
  accessToken: string
): Promise<string> {
  const metadata = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
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

    const { marketingProjectId } = requestBody;

    if (!marketingProjectId) {
      console.error('Missing marketing project ID');
      return new Response(
        JSON.stringify({ error: 'Marketing project ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get marketing project with folder ID
    const { data: marketingProject, error: projectError } = await supabase
      .from('marketing_projects')
      .select('id, google_drive_folder_id, project_reference')
      .eq('id', marketingProjectId)
      .single();

    if (projectError || !marketingProject) {
      console.error('Failed to fetch marketing project:', projectError);
      return new Response(
        JSON.stringify({ error: 'Marketing project not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!marketingProject.google_drive_folder_id) {
      return new Response(
        JSON.stringify({
          error: 'Marketing project does not have a Google Drive folder. Please create the project folder first.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get all social posts for this marketing project
    const { data: posts, error: postsError } = await supabase
      .from('marketing_social_posts')
      .select('id, post_id, title')
      .eq('marketing_project_id', marketingProjectId)
      .order('created_at', { ascending: true });

    if (postsError) {
      console.error('Failed to fetch posts:', postsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch posts' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No posts found for this marketing project',
          folders_created: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get Google OAuth credentials
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

    // Find Marketing folder
    console.log('Looking for Marketing folder...');
    const marketingFolderId = await findSubfolder(
      marketingProject.google_drive_folder_id,
      'Marketing',
      accessToken
    );

    if (!marketingFolderId) {
      return new Response(
        JSON.stringify({
          error: 'Marketing folder not found. Please ensure the marketing project folder structure exists.'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Marketing folder found: ${marketingFolderId}`);

    // Find Social_Media folder under Marketing
    console.log('Looking for Social_Media folder...');
    let socialMediaFolderId = await findSubfolder(
      marketingFolderId,
      'Social_Media',
      accessToken
    );

    // If Social_Media folder doesn't exist, create it
    if (!socialMediaFolderId) {
      console.log('Social_Media folder not found, creating it...');
      socialMediaFolderId = await createGoogleDriveFolder(
        'Social_Media',
        marketingFolderId,
        accessToken
      );
      console.log(`Social_Media folder created: ${socialMediaFolderId}`);
    } else {
      console.log(`Social_Media folder found: ${socialMediaFolderId}`);
    }

    // Create folders for each post
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      try {
        const folderName = post.post_id || `Post_${post.id.substring(0, 8)}`;
        console.log(`Creating folder for post: ${folderName}`);

        const folderId = await createGoogleDriveFolder(
          folderName,
          socialMediaFolderId,
          accessToken
        );

        console.log(`Folder created: ${folderId} for post ${post.post_id}`);

        results.push({
          post_id: post.post_id,
          folder_id: folderId,
          folder_name: folderName,
          success: true
        });

        successCount++;
      } catch (error) {
        console.error(`Failed to create folder for post ${post.post_id}:`, error);
        results.push({
          post_id: post.post_id,
          error: error.message,
          success: false
        });
        errorCount++;
      }
    }

    console.log(`Folder creation complete. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${successCount} folders for existing posts`,
        folders_created: successCount,
        errors: errorCount,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating post folders:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});