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

interface ChecklistItemRow {
  id: string;
  checklist_id: string;
  funding_document_checklist: {
    category: string;
    document_name: string;
  } | null;
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
    const checklistRootId = await createFolder('Checklist', parent_folder_id, access_token);
    console.log('Created Checklist root folder:', checklistRootId);

    const folderMap: Record<string, string> = { 'Checklist': checklistRootId };
    let totalFolders = 1;

    for (const [mainProject, subProjects] of mainProjectMap) {
      // Create main project folder under Checklist
      const mainFolderId = await createFolder(mainProject, checklistRootId, access_token);
      folderMap[`Checklist/${mainProject}`] = mainFolderId;
      totalFolders++;
      console.log(`Created main project folder: ${mainProject}`);

      // Create the 5 shared document folders under main project and record their IDs
      for (const subfolder of SHARED_SUBFOLDERS) {
        const sharedFolderId = await createFolder(subfolder, mainFolderId, access_token);
        folderMap[`Checklist/${mainProject}/${subfolder}`] = sharedFolderId;
        totalFolders++;
        console.log(`Created shared subfolder: ${mainProject}/${subfolder}`);
      }

      // Create sub project folders
      for (const subProject of subProjects) {
        const subFolderId = await createFolder(subProject, mainFolderId, access_token);
        folderMap[`Checklist/${mainProject}/${subProject}`] = subFolderId;
        totalFolders++;
        console.log(`Created sub project folder: ${mainProject}/${subProject}`);

        // Get unique checklist categories for this main+sub combination
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
          const catFolderId = await createFolder(category, subFolderId, access_token);
          folderMap[`Checklist/${mainProject}/${subProject}/${category}`] = catFolderId;
          totalFolders++;
          console.log(`Created category folder: ${mainProject}/${subProject}/${category}`);
        }
      }
    }

    // --- Save folder IDs to project_checklist_items ---
    // Fetch all checklist items for this project, joined with their template category/document_name
    const { data: checklistItems } = await supabase
      .from('project_checklist_items')
      .select('id, checklist_id, funding_document_checklist(category, document_name)')
      .eq('project_id', project_id);

    if (checklistItems && checklistItems.length > 0) {
      // Build a lookup: checklist_category -> list of (main_project, sub_project) pairs
      // so we know which folder path to use for each item
      const categoryToPath = new Map<string, string>();

      // For category-level items: path = Checklist/{main}/{sub}/{category}
      for (const d of projectDetails) {
        const mp = d.main_project?.trim();
        const sp = d.sub_project?.trim();
        const cat = d.checklist_category?.trim();
        if (!mp || !sp || !cat) continue;
        const key = `${mp}|||${sp}|||${cat}`;
        const path = `Checklist/${mp}/${sp}/${cat}`;
        if (folderMap[path] && !categoryToPath.has(cat)) {
          categoryToPath.set(cat, folderMap[path]);
        }
        // Use a more specific key to handle same category under different sub-projects
        categoryToPath.set(key, folderMap[path] || '');
      }

      const updates: Array<{ id: string; drive_folder_id: string }> = [];

      for (const item of checklistItems as ChecklistItemRow[]) {
        const tmpl = item.funding_document_checklist;
        if (!tmpl) continue;

        const docName = tmpl.document_name?.trim();
        const cat = tmpl.category?.trim();

        // Check if this is a shared doc (matched by document_name prefix)
        const sharedMatch = SHARED_SUBFOLDERS.find(sf => docName === sf || docName?.startsWith(sf));

        if (sharedMatch) {
          // Find which main_project this item belongs to via its category
          // Look for a detail row where checklist_category matches
          const detailForItem = projectDetails.find(d => d.checklist_category?.trim() === cat);
          if (detailForItem) {
            const mp = detailForItem.main_project.trim();
            const sharedFolderPath = `Checklist/${mp}/${sharedMatch}`;
            const folderId = folderMap[sharedFolderPath];
            if (folderId) updates.push({ id: item.id, drive_folder_id: folderId });
          }
        } else {
          // Category-level item — find its folder via main+sub+category
          const detailForItem = projectDetails.find(d => d.checklist_category?.trim() === cat);
          if (detailForItem) {
            const mp = detailForItem.main_project.trim();
            const sp = detailForItem.sub_project?.trim();
            if (sp) {
              const catFolderPath = `Checklist/${mp}/${sp}/${cat}`;
              const folderId = folderMap[catFolderPath];
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

      console.log(`Updated drive_folder_id for ${updates.length} checklist items`);
    }

    const checklistDriveUrl = `https://drive.google.com/drive/folders/${checklistRootId}`;

    return new Response(
      JSON.stringify({
        success: true,
        checklist_folder_id: checklistRootId,
        checklist_drive_url: checklistDriveUrl,
        folders_created: totalFolders,
        folder_map: folderMap,
        items_linked: checklistItems?.length ?? 0,
        message: `Successfully created ${totalFolders} folders and linked ${checklistItems?.length ?? 0} checklist items.`,
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
