import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function listFilesInFolder(
  folderId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string; mimeType: string; size: string; webViewLink: string }>> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name,mimeType,size,webViewLink)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    pageSize: '1000',
  });

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.warn(`Failed to list files in folder ${folderId}: ${await res.text()}`);
    return [];
  }

  const data = await res.json();
  return data.files || [];
}

function getExtension(mimeType: string, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext) return ext;
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.google-apps.document': 'gdoc',
    'application/vnd.google-apps.spreadsheet': 'gsheet',
  };
  return mimeMap[mimeType] || 'file';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { project_id } = body;

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: 'project_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google credentials
    const { data: credentials, error: credError } = await supabase
      .from('google_oauth_credentials')
      .select('*')
      .eq('service_name', 'google_drive')
      .maybeSingle();

    if (credError || !credentials) {
      return new Response(
        JSON.stringify({ error: 'Google Drive not connected.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let access_token = credentials.access_token;
    const token_expires_at = new Date(credentials.token_expires_at);
    const now = new Date();

    if (token_expires_at < new Date(now.getTime() + 5 * 60 * 1000)) {
      access_token = await refreshGoogleToken(credentials.refresh_token);
      await supabase
        .from('google_oauth_credentials')
        .update({
          access_token,
          token_expires_at: new Date(now.getTime() + 3600 * 1000).toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('service_name', 'google_drive');
    }

    // Load all saved folders for this project
    const { data: folderRows, error: folderErr } = await supabase
      .from('project_checklist_folders')
      .select('folder_path, folder_type, drive_folder_id')
      .eq('project_id', project_id);

    if (folderErr) throw folderErr;

    if (!folderRows || folderRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No checklist folders found for this project. Please create checklist folders first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load checklist items to map folder → item
    const { data: checklistItems, error: itemsErr } = await supabase
      .from('project_checklist_items')
      .select('id, drive_folder_id, document_name, category')
      .eq('project_id', project_id);

    if (itemsErr) throw itemsErr;

    // Build drive_folder_id → checklist_item_id map
    const folderToItemId: Record<string, string> = {};
    for (const item of (checklistItems || [])) {
      if (item.drive_folder_id) {
        folderToItemId[item.drive_folder_id] = item.id;
      }
    }

    // Load existing file_id records to avoid duplicates
    const { data: existingFiles } = await supabase
      .from('project_checklist_files')
      .select('file_id')
      .not('file_id', 'is', null);

    const existingFileIds = new Set((existingFiles || []).map((f: { file_id: string }) => f.file_id));

    let totalScanned = 0;
    let totalInserted = 0;

    const newFileRows: Array<{
      checklist_item_id: string;
      file_id: string;
      file_url: string;
      file_name: string;
      file_type: string;
      file_size: number | null;
      drive_folder_id: string;
      extracted_data: Record<string, unknown>;
      is_verified_by_ai: boolean;
    }> = [];

    // Scan every saved folder
    for (const folder of folderRows as Array<{ folder_path: string; folder_type: string; drive_folder_id: string }>) {
      const { drive_folder_id } = folder;
      const checklistItemId = folderToItemId[drive_folder_id];

      if (!checklistItemId) {
        // folder has no matching checklist item — skip file insertion
        continue;
      }

      const files = await listFilesInFolder(drive_folder_id, access_token);
      totalScanned += files.length;

      for (const file of files) {
        if (existingFileIds.has(file.id)) continue;

        newFileRows.push({
          checklist_item_id: checklistItemId,
          file_id: file.id,
          file_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          file_name: file.name,
          file_type: getExtension(file.mimeType, file.name),
          file_size: file.size ? parseInt(file.size, 10) : null,
          drive_folder_id: drive_folder_id,
          extracted_data: {},
          is_verified_by_ai: false,
        });

        existingFileIds.add(file.id);
      }
    }

    // Batch insert in chunks of 50
    for (let i = 0; i < newFileRows.length; i += 50) {
      const chunk = newFileRows.slice(i, i + 50);
      const { error: insertErr } = await supabase
        .from('project_checklist_files')
        .insert(chunk);
      if (insertErr) {
        console.error('Insert error:', insertErr);
      } else {
        totalInserted += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        folders_scanned: folderRows.length,
        files_found: totalScanned,
        files_inserted: totalInserted,
        message: `Scanned ${folderRows.length} folders, found ${totalScanned} files, inserted ${totalInserted} new records.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('sync-checklist-files error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
