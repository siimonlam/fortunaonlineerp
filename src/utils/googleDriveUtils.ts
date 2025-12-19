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

  try {
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
      const errorText = await response.text();
      let errorMessage = 'Failed to create folders';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Cannot connect to Supabase. Check if edge function is deployed and accessible.');
    }
    throw error;
  }
}

export async function createMarketingProjectFolders(
  projectId: string,
  marketingReference: string,
  brandName?: string,
  companyName?: string
): Promise<{ success: boolean; root_folder_id: string; folder_map: Record<string, string> }> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-marketing-folders`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        marketingReference,
        brandName,
        companyName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to create folders';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Cannot connect to Supabase. Check if edge function is deployed and accessible.');
    }
    throw error;
  }
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
