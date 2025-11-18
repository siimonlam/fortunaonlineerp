import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/siimonlam/fortunaonlineerp/main/templatefiles/budfolder';

const TEMPLATE_FILES = [
  'BUD-checklist-2024-CHI.docx',
  'Budget_V1.1_Chi_blank.xlsx',
  'Template BUD 申請所需文件(內地_FTA 計劃).xlsx',
  'Review/Q&A_Request_Clent.docx',
  'Review/Q&A_Request_vendor.docx',
  'Upload/Note_for_Applicant_Venders_full_ver.pdf',
  'Final-Report/Final_Report_Summary_V3.xlsm',
  'Final-Report/Final_Report_Summary_V6.xlsm',
  'Final-Report/Quotation/Appendix.docx',
  'Final-Report/Quotation/Vendor suggestion list.xlsx',
  'Final-Report/Quotation/quotation-request-form-en.doc',
  'Final-Report/Quotation/quotation-request-form-CN.docx',
  'Final-Report/Quotation/quotation-request-form-CN_audit.docx',
  'Final-Report/Quotation/Audit/audit.docx',
  'Final-Report/Quotation/Audit/Appendix.docx',
  'Final-Report/Quotation/Audit/quotation-request-form-CN.pdf',
  'Final-Report/Quotation/Audit/supplier-confirmation-form-CH.pdf',
  'Final-Report/Quotation/Audit/quotation-request-form-CN_audit.docx',
  'Final-Report/Quotation/Audit/檢查文件 - 為獲批項目所需的帳目外聘核數費.txt',
];

const BUD_FOLDER_STRUCTURE = [
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
  'Document/其他/Plan-example',
  'Document/其他/Plan-Quotation',
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

async function uploadFileToGoogleDrive(
  fileName: string,
  fileBlob: Blob,
  mimeType: string,
  parentId: string,
  accessToken: string
): Promise<string> {
  const metadata = {
    name: fileName,
    parents: [parentId],
    mimeType: mimeType,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', fileBlob);

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file "${fileName}": ${error}`);
  }

  const data = await response.json();
  return data.id;
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    'txt': 'text/plain',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
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

async function createFolderStructure(
  rootFolderId: string,
  accessToken: string
): Promise<Record<string, string>> {
  const folderMap: Record<string, string> = { '': rootFolderId };

  for (const folderPath of BUD_FOLDER_STRUCTURE) {
    const parts = folderPath.split('/');
    const folderName = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const parentId = folderMap[parentPath];

    if (!parentId) {
      console.error(`Parent folder not found for path: ${folderPath}`);
      continue;
    }

    try {
      const folderId = await createGoogleDriveFolder(folderName, parentId, accessToken);
      folderMap[folderPath] = folderId;
      console.log(`Created folder: ${folderPath}`);
    } catch (error) {
      console.error(`Failed to create folder ${folderPath}:`, error);
    }
  }

  return folderMap;
}

async function copyTemplateFiles(
  folderMap: Record<string, string>,
  accessToken: string
): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0;
  let failed = 0;

  for (const templatePath of TEMPLATE_FILES) {
    try {
      const githubUrl = `${GITHUB_RAW_BASE}/${encodeURI(templatePath)}`;
      console.log(`Fetching template file from: ${githubUrl}`);

      const fileResponse = await fetch(githubUrl);

      if (!fileResponse.ok) {
        console.error(`Failed to fetch ${templatePath}: ${fileResponse.status}`);
        failed++;
        continue;
      }

      const fileBlob = await fileResponse.blob();
      const fileName = templatePath.split('/').pop() || templatePath;
      const folderPath = templatePath.includes('/')
        ? templatePath.substring(0, templatePath.lastIndexOf('/'))
        : '';

      const parentFolderId = folderMap[folderPath] || folderMap[''];

      if (!parentFolderId) {
        console.error(`Parent folder not found for ${templatePath}`);
        failed++;
        continue;
      }

      const mimeType = getMimeType(fileName);
      await uploadFileToGoogleDrive(fileName, fileBlob, mimeType, parentFolderId, accessToken);

      console.log(`✓ Uploaded: ${templatePath}`);
      uploaded++;
    } catch (error) {
      console.error(`Failed to upload ${templatePath}:`, error);
      failed++;
    }
  }

  return { uploaded, failed };
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

  let body;
  try {
    body = await req.json();
  } catch (parseError) {
    console.error('Failed to parse request body:', parseError);
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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

    const { project_id, project_name, project_reference } = body;

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

    console.log('Creating root folder:', rootFolderName);

    const rootFolderId = await createGoogleDriveFolder(rootFolderName, parent_folder_id, access_token);

    console.log('Creating folder structure...');
    const folderMap = await createFolderStructure(rootFolderId, access_token);

    const foldersCreated = Object.keys(folderMap).length;

    console.log('Copying template files from GitHub...');
    const fileStats = await copyTemplateFiles(folderMap, access_token);
    console.log(`Files uploaded: ${fileStats.uploaded}, Failed: ${fileStats.failed}`);

    await supabase.from('project_folders').insert({
      project_id,
      parent_folder_id: rootFolderId,
      folder_structure: folderMap,
      status: 'completed',
      error_message: null,
    });

    const driveUrl = `https://drive.google.com/drive/folders/${rootFolderId}`;

    const response = {
      success: true,
      root_folder_id: rootFolderId,
      drive_url: driveUrl,
      folders_created: foldersCreated,
      total_folders: BUD_FOLDER_STRUCTURE.length + 1,
      files_uploaded: fileStats.uploaded,
      files_failed: fileStats.failed,
      total_files: TEMPLATE_FILES.length,
      message: `Successfully created ${foldersCreated} folders and uploaded ${fileStats.uploaded}/${TEMPLATE_FILES.length} template files.`,
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