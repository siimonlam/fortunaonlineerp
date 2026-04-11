import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';

const SHARED_SUBFOLDERS = [
  'Quotation 報價',
  '反圍標',
  '供應商發票',
  '供應商收據',
  '付款紀錄證明',
];

async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

async function createFolder(
  name: string,
  parentId: string,
  accessToken: string
): Promise<string> {
  const response = await fetch(`${GOOGLE_DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create folder "${name}": ${error}`);
  }

  const data = await response.json();

  try {
    await fetch(
      `${GOOGLE_DRIVE_API}/files/${data.id}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'writer', type: 'anyone' }),
      }
    );
  } catch (err) {
    console.warn(`Failed to share folder "${name}":`, err);
  }

  return data.id;
}

interface ProjectDetail {
  main_project: string;
  sub_project: string | null;
  checklist_category: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { project_id, parent_folder_id } = body;

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: 'project_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parent_folder_id) {
      return new Response(
        JSON.stringify({ error: 'parent_folder_id is required. Please create BUD folders first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: credentials, error: credError } = await supabase
      .from('google_oauth_credentials')
      .select('*')
      .eq('service_name', 'google_drive')
      .maybeSingle();

    if (credError || !credentials) {
      return new Response(
        JSON.stringify({ error: 'Google Drive not connected. Please authorize Google Drive in Settings.' }),
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

    const { data: details, error: detailsError } = await supabase
      .from('funding_project_details')
      .select('main_project, sub_project, checklist_category')
      .eq('project_id', project_id)
      .not('main_project', 'is', null)
      .not('main_project', 'eq', '');

    if (detailsError) throw detailsError;

    const projectDetails: ProjectDetail[] = details || [];

    if (projectDetails.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No project details found. Please extract project details first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load existing saved folders for this project
    const { data: existingFolderRows } = await supabase
      .from('project_checklist_folders')
      .select('folder_path, drive_folder_id')
      .eq('project_id', project_id);

    const folderMap: Record<string, string> = {};
    (existingFolderRows || []).forEach((row: { folder_path: string; drive_folder_id: string }) => {
      folderMap[row.folder_path] = row.drive_folder_id;
    });

    const newFolderRows: Array<{
      project_id: string;
      folder_path: string;
      folder_type: string;
      folder_name: string;
      drive_folder_id: string;
      parent_drive_folder_id: string | null;
    }> = [];

    async function getOrCreateFolder(
      path: string,
      name: string,
      parentDriveId: string,
      folderType: string
    ): Promise<string> {
      if (folderMap[path]) return folderMap[path];
      const driveId = await createFolder(name, parentDriveId, access_token);
      folderMap[path] = driveId;
      newFolderRows.push({
        project_id,
        folder_path: path,
        folder_type: folderType,
        folder_name: name,
        drive_folder_id: driveId,
        parent_drive_folder_id: parentDriveId,
      });
      return driveId;
    }

    // Group: main_project -> Set of sub_projects
    const mainProjectMap = new Map<string, Set<string>>();
    for (const d of projectDetails) {
      const mp = d.main_project.trim();
      if (!mp) continue;
      if (!mainProjectMap.has(mp)) mainProjectMap.set(mp, new Set());
      const sp = d.sub_project?.trim();
      if (sp) mainProjectMap.get(mp)!.add(sp);
    }

    // Create root "Checklist" folder
    const checklistRootId = await getOrCreateFolder('Checklist', 'Checklist', parent_folder_id, 'root');
    console.log('Checklist root folder:', checklistRootId);

    let totalFolders = newFolderRows.length;

    for (const [mainProject, subProjects] of mainProjectMap) {
      const mainPath = `Checklist/${mainProject}`;
      const mainFolderId = await getOrCreateFolder(mainPath, mainProject, checklistRootId, 'main_project');
      console.log(`Main project folder: ${mainProject}`);

      // Shared document folders under main project
      for (const subfolder of SHARED_SUBFOLDERS) {
        const sharedPath = `${mainPath}/${subfolder}`;
        await getOrCreateFolder(sharedPath, subfolder, mainFolderId, 'shared_doc');
        console.log(`Shared subfolder: ${mainProject}/${subfolder}`);
      }

      // Sub project folders
      for (const subProject of subProjects) {
        const subPath = `${mainPath}/${subProject}`;
        const subFolderId = await getOrCreateFolder(subPath, subProject, mainFolderId, 'sub_project');
        console.log(`Sub project folder: ${mainProject}/${subProject}`);

        // Category folders under sub project
        const categoriesForSub = new Set<string>();
        for (const d of projectDetails) {
          if (
            d.main_project.trim() === mainProject &&
            d.sub_project?.trim() === subProject &&
            d.checklist_category?.trim()
          ) {
            categoriesForSub.add(d.checklist_category.trim());
          }
        }

        for (const category of categoriesForSub) {
          const catPath = `${subPath}/${category}`;
          await getOrCreateFolder(catPath, category, subFolderId, 'category');
          console.log(`Category folder: ${mainProject}/${subProject}/${category}`);
        }
      }
    }

    totalFolders = newFolderRows.length;

    // Persist new folders to project_checklist_folders table
    if (newFolderRows.length > 0) {
      const { error: insertErr } = await supabase
        .from('project_checklist_folders')
        .upsert(newFolderRows, { onConflict: 'project_id,folder_path' });
      if (insertErr) console.error('Failed to save folder rows:', insertErr);
      else console.log(`Saved ${newFolderRows.length} folder rows to DB`);
    }

    // Link drive_folder_id to project_checklist_items
    const { data: checklistItems } = await supabase
      .from('project_checklist_items')
      .select('id, checklist_id, category, document_name')
      .eq('project_id', project_id);

    const updates: Array<{ id: string; drive_folder_id: string }> = [];

    if (checklistItems && checklistItems.length > 0) {
      for (const item of checklistItems as Array<{ id: string; checklist_id: string; category: string; document_name: string }>) {
        const docName = item.document_name?.trim();
        const cat = item.category?.trim();

        const isShared = SHARED_SUBFOLDERS.includes(docName);

        if (isShared) {
          // Find which main_project this item's category belongs to
          const detailForItem = projectDetails.find(d => d.checklist_category?.trim() === cat);
          if (detailForItem) {
            const mp = detailForItem.main_project.trim();
            const sharedPath = `Checklist/${mp}/${docName}`;
            const folderId = folderMap[sharedPath];
            if (folderId) updates.push({ id: item.id, drive_folder_id: folderId });
          }
        } else {
          // Category-level item
          const detailForItem = projectDetails.find(d => d.checklist_category?.trim() === cat);
          if (detailForItem) {
            const mp = detailForItem.main_project.trim();
            const sp = detailForItem.sub_project?.trim();
            if (sp) {
              const catPath = `Checklist/${mp}/${sp}/${cat}`;
              const folderId = folderMap[catPath];
              if (folderId) updates.push({ id: item.id, drive_folder_id: folderId });
            }
          }
        }
      }

      // Batch update in chunks of 50
      for (let i = 0; i < updates.length; i += 50) {
        const chunk = updates.slice(i, i + 50);
        await Promise.all(
          chunk.map(({ id, drive_folder_id }) =>
            supabase
              .from('project_checklist_items')
              .update({ drive_folder_id })
              .eq('id', id)
          )
        );
      }

      console.log(`Linked drive_folder_id for ${updates.length} checklist items`);
    }

    const checklistRootEntry = folderMap['Checklist'];
    const checklistDriveUrl = `https://drive.google.com/drive/folders/${checklistRootEntry}`;

    return new Response(
      JSON.stringify({
        success: true,
        checklist_folder_id: checklistRootEntry,
        checklist_drive_url: checklistDriveUrl,
        folders_created: totalFolders,
        folders_reused: Object.keys(folderMap).length - totalFolders,
        items_linked: updates.length,
        message: `Created ${totalFolders} new folders, reused ${Object.keys(folderMap).length - totalFolders} existing folders, linked ${updates.length} checklist items.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-checklist-folders function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
