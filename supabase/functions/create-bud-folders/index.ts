import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_API_KEY = 'AIzaSyCaL5l3z5Lpt8_34CuYgsrCjlOQfZegQOg';

interface FolderStructure {
  path: string;
  driveId?: string;
}

const FOLDER_STRUCTURE: string[] = [
  'Agreement',
  'Document',
  'Document/代理權證明書',
  'Document/內地業務單位',
  'Document/內地業務單位/股權分配',
  'Document/內地業務單位/营业执照',
  'Document/內地業務單位/訂單',
  'Document/公司文件',
  'Document/公司文件/BR',
  'Document/公司文件/CI',
  'Document/公司文件/NAR1',
  'Document/公司相片',
  'Document/其他',
  'Document/其他/Company-Profile',
  'Document/其他/Plan-Quotation',
  'Document/其他/Plan-example',
  'Document/其他/宣傳單張',
  'Document/業務運作證明文件',
  'Document/業務運作證明文件/Audit-Report',
  'Document/業務運作證明文件/Bills',
  'Document/業務運作證明文件/MPF',
  'Document/業務運作證明文件/Sales',
  'Document/產品',
  'Document/產品/Certificate',
  'Document/產品/Import',
  'Document/產品/Trademark',
  'Final-Report',
  'Final-Report/1. Audit',
  'Final-Report/1. Audit/Invoice_Reciept',
  'Final-Report/1. Audit/Quotation',
  'Final-Report/1. Audit/Report',
  'Final-Report/2. Office_Setup',
  'Final-Report/2. Office_Setup/Company_Doc',
  'Final-Report/2. Office_Setup/Company_Doc/商業登記證 營業執照 章程 股東登記',
  'Final-Report/2. Office_Setup/Invoice_Receipt',
  'Final-Report/2. Office_Setup/Office_Photo',
  'Final-Report/2. Office_Setup/Quotation',
  'Final-Report/2. Office_Setup/Rental_Payment',
  'Final-Report/2. Office_Setup/Tenancy_Agreement',
  'Final-Report/3. Hiring',
  'Final-Report/3. Hiring/Contract',
  'Final-Report/3. Hiring/Job_Post',
  'Final-Report/3. Hiring/MPF_Statement',
  'Final-Report/3. Hiring/Other_CV',
  'Final-Report/3. Hiring/Salary_Slip',
  'Final-Report/3. Hiring/Selection_records',
  'Final-Report/4. Exhibition',
  'Final-Report/4. Exhibition/Invoice_Receipt',
  'Final-Report/4. Exhibition/參展入場證',
  'Final-Report/4. Exhibition/展位照片',
  'Final-Report/4. Exhibition/展會場刊',
  'Final-Report/4. Exhibition/登機證及酒店入住證明',
  'Final-Report/5. Website',
  'Final-Report/5. Website/Invoice_Reciept',
  'Final-Report/5. Website/New_Website_Capscreen',
  'Final-Report/5. Website/Old_website_Capscreen',
  'Final-Report/5. Website/Quotation',
  'Final-Report/6. Online_Platform',
  'Final-Report/6. Online_Platform/Invoice_Reciept',
  'Final-Report/6. Online_Platform/Quotation',
  'Final-Report/6. Online_Platform/Result_Capscreen',
  'Final-Report/7. Marketing',
  'Final-Report/7. Marketing/BackEnd_Traffic_Report',
  'Final-Report/7. Marketing/Capscreen',
  'Final-Report/7. Marketing/Invoice_Reciept',
  'Final-Report/7. Marketing/Quotation',
  'Final-Report/8. Production',
  'Final-Report/8. Production/Invoice_Reciept',
  'Final-Report/8. Production/Quotation',
  'Final-Report/8. Production/Result',
  'Final-Report/Agreements',
  'Final-Report/Quotation',
  'Final-Report/Quotation/Audit',
  'Review',
  'Review/Review1',
  'Upload',
];

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
    throw new Error(`Failed to create folder "${name}": ${error}`);
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

    const { project_id, project_name } = await req.json();

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
        console.error('Failed to refresh token:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Google Drive token. Please re-authenticate.' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const refreshData = await refreshResponse.json();
      access_token = refreshData.access_token;

      // Update the database with new token
      const new_expires_at = new Date(now.getTime() + 3600 * 1000); // 1 hour from now
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

    // Create root folder for this project
    const rootFolderName = project_name || `Project ${project_id}`;
    console.log('Creating root folder:', rootFolderName);
    const rootFolderId = await createGoogleDriveFolder(rootFolderName, parent_folder_id, access_token);

    // Track created folders
    const folderMap: Record<string, string> = {
      '': rootFolderId, // Root folder
    };

    const errors: Array<{ path: string; error: string }> = [];
    let successCount = 0;

    // Create all folders in order
    for (const folderPath of FOLDER_STRUCTURE) {
      try {
        const parts = folderPath.split('/');
        const folderName = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');
        const parentFolderId = folderMap[parentPath] || rootFolderId;

        console.log(`Creating folder: ${folderPath} under parent: ${parentPath}`);
        const folderId = await createGoogleDriveFolder(folderName, parentFolderId, access_token);
        folderMap[folderPath] = folderId;
        successCount++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error creating folder ${folderPath}:`, error);
        errors.push({ path: folderPath, error: error.message });
      }
    }

    // Store folder structure in database
    const { error: dbError } = await supabase.from('project_folders').insert({
      project_id,
      parent_folder_id: rootFolderId,
      folder_structure: folderMap,
      status: errors.length === 0 ? 'completed' : 'partial',
      error_message: errors.length > 0 ? JSON.stringify(errors) : null,
    });

    if (dbError) {
      console.error('Error saving folder structure to database:', dbError);
    }

    const response = {
      success: true,
      root_folder_id: rootFolderId,
      folders_created: successCount,
      total_folders: FOLDER_STRUCTURE.length + 1, // +1 for root
      errors: errors.length > 0 ? errors : undefined,
      folder_map: folderMap,
    };

    return new Response(JSON.stringify(response), {
      status: errors.length > 0 ? 207 : 200,
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