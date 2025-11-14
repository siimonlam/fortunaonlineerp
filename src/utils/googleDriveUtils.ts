import { supabase } from '../lib/supabase';

export interface CreateFoldersResponse {
  success: boolean;
  root_folder_id: string;
  folders_created: number;
  total_folders: number;
  errors?: Array<{ path: string; error: string }>;
  folder_map: Record<string, string>;
}

export async function createBudProjectFolders(
  projectId: string,
  projectName: string,
  projectReference?: string
): Promise<CreateFoldersResponse> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-bud-folders`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project_id: projectId,
      project_name: projectName,
      project_reference: projectReference,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create folders');
  }

  return await response.json();
}

export async function getProjectFolders(projectId: string) {
  const { data, error } = await supabase
    .from('project_folders')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
