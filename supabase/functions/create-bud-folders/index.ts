import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_API_KEY = 'AIzaSyCaL5l3z5Lpt8_34CuYgsrCjlOQfZegQOg';

// GitHub repository raw file base URL - update this with your repository URL
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/templatefiles/budfolder';

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

// Template files to copy to the root folder
const TEMPLATE_FILES: Array<{ path: string; name: string }> = [
  { path: 'BUD-checklist-2024-CHI.docx', name: 'BUD-checklist-2024-CHI.docx' },
  { path: 'Budget_V1.1_Chi_blank.xlsx', name: 'Budget_V1.1_Chi_blank.xlsx' },
  { path: 'Template BUD 申請所需文件(內地_FTA 計劃).xlsx', name: 'Template BUD 申請所需文件(內地_FTA 計劃).xlsx' },
  { path: 'Final-Report/Final_Report_Summary_V3.xlsm', name: 'Final_Report_Summary_V3.xlsm' },
  { path: 'Final-Report/Final_Report_Summary_V6.xlsm', name: 'Final_Report_Summary_V6.xlsm' },
  { path: 'Final-Report/Quotation/Appendix.docx', name: 'Appendix.docx' },
  { path: 'Final-Report/Quotation/Audit/Appendix.docx', name: 'Appendix.docx' },
  { path: 'Final-Report/Quotation/Audit/audit.docx', name: 'audit.docx' },
  { path: 'Final-Report/Quotation/Audit/quotation-request-form-CN.pdf', name: 'quotation-request-form-CN.pdf' },
  { path: 'Final-Report/Quotation/Audit/quotation-request-form-CN_audit.docx', name: 'quotation-request-form-CN_audit.docx' },
  { path: 'Final-Report/Quotation/Audit/supplier-confirmation-form-CH.pdf', name: 'supplier-confirmation-form-CH.pdf' },
  { path: 'Final-Report/Quotation/Vendor suggestion list.xlsx', name: 'Vendor suggestion list.xlsx' },
  { path: 'Final-Report/Quotation/quotation-request-form-CN.docx', name: 'quotation-request-form-CN.docx' },
  { path: 'Final-Report/Quotation/quotation-request-form-CN_audit.docx', name: 'quotation-request-form-CN_audit.docx' },
  { path: 'Final-Report/Quotation/quotation-request-form-en.doc', name: 'quotation-request-form-en.doc' },
  { path: 'Review/Q&A_Request_Clent.docx', name: 'Q&A_Request_Clent.docx' },
  { path: 'Review/Q&A_Request_vendor.docx', name: 'Q&A_Request_vendor.docx' },
  { path: 'Upload/Note_for_Applicant_Venders_full_ver.pdf', name: 'Note_for_Applicant_Venders_full_ver.pdf' },
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

async function uploadFileToGoogleDrive(
  fileName: string,
  fileContent: Blob,
  mimeType: string,
  parentFolderId: string,
  accessToken: string
): Promise<string> {
  const metadata = {
    name: fileName,
    parents: [parentFolderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', fileContent);

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file "${fileName}": ${error}`);
  }

  const data = await response.json();
  return data.id;
}

async function downloadFileFromGitHub(filePath: string): Promise<{ blob: Blob; mimeType: string }> {
  const encodedPath = encodeURI(filePath);
  const url = `${GITHUB_RAW_BASE}/${encodedPath}`;

  console.log('Downloading from GitHub:', url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${filePath} from GitHub: ${response.statusText}`);
  }

  const blob = await response.blob();

  // Determine MIME type from file extension
  let mimeType = 'application/octet-stream';
  if (filePath.endsWith('.docx')) {
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (filePath.endsWith('.doc')) {
    mimeType = 'application/msword';
  } else if (filePath.endsWith('.xlsx')) {
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (filePath.endsWith('.xlsm')) {
    mimeType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
  } else if (filePath.endsWith('.pdf')) {
    mimeType = 'application/pdf';
  }

  return { blob, mimeType };
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

    // Create root folder for this project using project_reference first
    const rootFolderName = project_reference
      ? `${project_reference} - ${project_name || 'Unnamed Project'}`
      : project_name || `Project ${project_id}`;
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

    // Copy template files to appropriate folders
    console.log('Copying template files from GitHub...');
    let filesUploaded = 0;
    for (const templateFile of TEMPLATE_FILES) {
      try {
        console.log(`Copying template file: ${templateFile.path}`);

        const { blob, mimeType } = await downloadFileFromGitHub(templateFile.path);

        // Determine target folder based on file path
        let targetFolderId = rootFolderId;
        const folderPath = templateFile.path.substring(0, templateFile.path.lastIndexOf('/'));
        if (folderPath && folderMap[folderPath]) {
          targetFolderId = folderMap[folderPath];
        }

        await uploadFileToGoogleDrive(
          templateFile.name,
          blob,
          mimeType,
          targetFolderId,
          access_token
        );

        filesUploaded++;
        console.log(`Successfully uploaded: ${templateFile.name}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`Error copying template file ${templateFile.path}:`, error);
        errors.push({ path: `file:${templateFile.path}`, error: error.message });
      }
    }

    console.log(`Uploaded ${filesUploaded} template files`);

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
      files_uploaded: filesUploaded,
      total_folders: FOLDER_STRUCTURE.length + 1, // +1 for root
      total_files: TEMPLATE_FILES.length,
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
