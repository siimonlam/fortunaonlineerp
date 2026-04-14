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
): Promise<{ files: Array<{ id: string; name: string; mimeType: string; size: string; webViewLink: string }>; error?: string }> {
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
    const errText = await res.text();
    console.warn(`Failed to list files in folder ${folderId}: ${errText}`);
    return { files: [], error: errText };
  }
  const data = await res.json();
  return { files: data.files || [] };
}

function getExtension(mimeType: string, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext && ext.length <= 5) return ext;
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

async function sendToN8n(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`n8n webhook response: ${res.status} for file ${payload.file_name}`);
  } catch (err) {
    console.error('n8n webhook failed:', err);
  }
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

    // --- Google credentials ---
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

    // --- Load checklist folders for this project ---
    const { data: folderRows, error: folderErr } = await supabase
      .from('project_checklist_folders')
      .select('folder_path, folder_type, folder_name, drive_folder_id')
      .eq('project_id', project_id);

    if (folderErr) throw folderErr;
    if (!folderRows || folderRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No checklist folders found. Please create checklist folders first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Load checklist items ---
    const { data: checklistItems, error: itemsErr } = await supabase
      .from('project_checklist_items')
      .select('id, drive_folder_id, document_name, category, checklist_id')
      .eq('project_id', project_id);

    if (itemsErr) throw itemsErr;

    // Build: drive_folder_id → array of items sharing that folder
    const folderToItems: Record<string, Array<{ id: string; document_name: string; category: string }>> = {};
    for (const item of (checklistItems || [])) {
      if (item.drive_folder_id) {
        if (!folderToItems[item.drive_folder_id]) folderToItems[item.drive_folder_id] = [];
        folderToItems[item.drive_folder_id].push({
          id: item.id,
          document_name: item.document_name,
          category: item.category,
        });
      }
    }

    // Build: drive_folder_id → ONE representative item per document_name
    // (for shared docs, many items share the same folder+document_name — pick one)
    const folderToRepresentativeItems: Record<string, Array<{ id: string; document_name: string; category: string }>> = {};
    for (const [folderId, items] of Object.entries(folderToItems)) {
      const seenDocNames = new Set<string>();
      const representatives: Array<{ id: string; document_name: string; category: string }> = [];
      for (const item of items) {
        const key = item.document_name || item.id;
        if (!seenDocNames.has(key)) {
          seenDocNames.add(key);
          representatives.push(item);
        }
      }
      folderToRepresentativeItems[folderId] = representatives;
    }

    // --- Load check templates ---
    type CheckTemplate = {
      id: string;
      category: string;
      document_name: string;
      description: string;
      is_required: boolean;
      order_index: number;
    };

    const { data: allCheckTemplates, error: templatesErr } = await supabase
      .from('funding_document_checklist')
      .select('id, category, document_name, description, is_required, order_index')
      .order('order_index');

    if (templatesErr) throw templatesErr;

    const templatesByKey: Record<string, CheckTemplate[]> = {};
    for (const t of (allCheckTemplates || []) as CheckTemplate[]) {
      const key = `${t.category}|||${t.document_name}`;
      if (!templatesByKey[key]) templatesByKey[key] = [];
      templatesByKey[key].push(t);
    }

    // Deduplicated by description across all categories for a given document_name
    const templatesByDocName: Record<string, CheckTemplate[]> = {};
    for (const t of (allCheckTemplates || []) as CheckTemplate[]) {
      if (!templatesByDocName[t.document_name]) templatesByDocName[t.document_name] = [];
      const alreadyHas = templatesByDocName[t.document_name].some(x => x.description === t.description);
      if (!alreadyHas) templatesByDocName[t.document_name].push(t);
    }

    // --- Load existing file rows to prevent duplicates ---
    // Key: drive_file_id|||drive_folder_id — one row per physical file per folder
    const { data: allProjectFiles } = await supabase
      .from('project_checklist_files')
      .select('id, file_id, drive_folder_id')
      .eq('project_id', project_id);

    const existingFilePairs = new Set<string>();
    for (const f of (allProjectFiles || []) as Array<{ id: string; file_id: string; drive_folder_id: string }>) {
      if (f.file_id && f.drive_folder_id) existingFilePairs.add(`${f.file_id}|||${f.drive_folder_id}`);
    }

    let totalScanned = 0;
    let totalFilesInserted = 0;
    let totalChecksInserted = 0;
    const folderDebug: Array<{ folder_id: string; folder_name: string; files_found: number; error?: string }> = [];
    const newFilePayloads: Array<Record<string, unknown>> = [];

    // Collect unique folder IDs from checklist items only (not top-level folders which are parents)
    const allFolderIdsToScan = new Set<string>();
    for (const item of (checklistItems || [])) {
      if (item.drive_folder_id) allFolderIdsToScan.add(item.drive_folder_id);
    }

    const scannedFolderIds = new Set<string>();

    for (const drive_folder_id of allFolderIdsToScan) {
      if (scannedFolderIds.has(drive_folder_id)) continue;
      scannedFolderIds.add(drive_folder_id);

      // Pick ONE representative item for this folder to use as the anchor
      const repItems = folderToRepresentativeItems[drive_folder_id];
      if (!repItems || repItems.length === 0) continue;
      // Use the first representative item as the single anchor for all files in this folder
      const anchorItem = repItems[0];

      const { files, error: driveErr } = await listFilesInFolder(drive_folder_id, access_token);
      folderDebug.push({
        folder_id: drive_folder_id,
        folder_name: anchorItem.document_name || drive_folder_id,
        files_found: files.length,
        error: driveErr,
      });
      totalScanned += files.length;

      for (const file of files as Array<{ id: string; name: string; mimeType: string; size: string; webViewLink: string }>) {
        // ONE row per (drive_file_id, drive_folder_id) — skip if already exists
        const pairKey = `${file.id}|||${drive_folder_id}`;
        if (existingFilePairs.has(pairKey)) continue;

        const documentType = anchorItem.document_name || null;
        const category = anchorItem.category || null;

        const { data: insertedFile, error: fileInsertErr } = await supabase
          .from('project_checklist_files')
          .insert({
            checklist_item_id: anchorItem.id,
            file_id: file.id,
            file_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
            file_name: file.name,
            file_type: getExtension(file.mimeType, file.name),
            file_size: file.size ? parseInt(file.size, 10) : null,
            drive_folder_id: drive_folder_id,
            document_type: documentType,
            project_id,
            extracted_data: {},
            is_verified_by_ai: false,
          })
          .select('id')
          .single();

        if (fileInsertErr || !insertedFile) {
          console.error('File insert error:', fileInsertErr);
          continue;
        }

        existingFilePairs.add(pairKey);
        totalFilesInserted++;

        if (!documentType) continue;

        // Use category-specific templates first, then deduplicated doc-level templates
        const specificKey = `${category}|||${documentType}`;
        let checkTemplates: CheckTemplate[] = templatesByKey[specificKey] || [];
        if (checkTemplates.length === 0) {
          checkTemplates = templatesByDocName[documentType] || [];
        }

        if (checkTemplates.length === 0) continue;

        const checkRows = checkTemplates.map((t) => ({
          file_id: insertedFile.id,
          checklist_item_id: anchorItem.id,
          project_id,
          document_type: documentType,
          category: t.category,
          description: t.description,
          order_index: t.order_index,
          is_required: t.is_required,
          is_checked: false,
          is_checked_by_ai: false,
          drive_folder_id,
          google_file_id: file.id,
        }));

        for (let i = 0; i < checkRows.length; i += 50) {
          const chunk = checkRows.slice(i, i + 50);
          const { error: checksErr } = await supabase
            .from('project_checklist_file_checks')
            .insert(chunk);
          if (!checksErr) {
            totalChecksInserted += chunk.length;
          } else {
            console.error('Checks insert error:', checksErr);
          }
        }

        // Collect payload for n8n
        newFilePayloads.push({
          project_id,
          file_row_id: insertedFile.id,
          drive_file_id: file.id,
          file_name: file.name,
          file_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          document_name: documentType,
          category,
          checklist_item_id: anchorItem.id,
          check_count: checkRows.length,
        });
      }
    }

    // --- Send each new file to n8n for AI validation ---
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (n8nWebhookUrl && newFilePayloads.length > 0) {
      await Promise.allSettled(newFilePayloads.map(payload => sendToN8n(n8nWebhookUrl, payload)));
    }

    return new Response(
      JSON.stringify({
        success: true,
        folders_scanned: scannedFolderIds.size,
        files_found: totalScanned,
        files_inserted: totalFilesInserted,
        checks_inserted: totalChecksInserted,
        message: `Scanned ${scannedFolderIds.size} folders, found ${totalScanned} files, inserted ${totalFilesInserted} new files with ${totalChecksInserted} check items.`,
        debug: folderDebug,
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
