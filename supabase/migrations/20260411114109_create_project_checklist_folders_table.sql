/*
  # Create project_checklist_folders table

  Stores every Google Drive folder created by the create-checklist-folders edge function,
  so folder IDs can be looked up and reused without recreating them.

  ## New Table: project_checklist_folders
  - id: primary key
  - project_id: foreign key to projects
  - folder_path: the logical path key (e.g. "Checklist", "Checklist/主項目", "Checklist/主項目/子項目/類別")
  - folder_type: one of 'root' | 'main_project' | 'shared_doc' | 'sub_project' | 'category'
  - folder_name: the actual folder name on Drive
  - drive_folder_id: the Google Drive folder ID
  - parent_drive_folder_id: parent folder's Drive ID
  - created_at: timestamp

  ## Security
  - RLS enabled
  - Authenticated users can read/insert/update their own project folders
*/

CREATE TABLE IF NOT EXISTS project_checklist_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_path text NOT NULL,
  folder_type text NOT NULL DEFAULT 'category',
  folder_name text NOT NULL,
  drive_folder_id text NOT NULL,
  parent_drive_folder_id text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, folder_path)
);

CREATE INDEX IF NOT EXISTS idx_project_checklist_folders_project_id ON project_checklist_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_checklist_folders_path ON project_checklist_folders(project_id, folder_path);

ALTER TABLE project_checklist_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read project checklist folders"
  ON project_checklist_folders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert project checklist folders"
  ON project_checklist_folders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update project checklist folders"
  ON project_checklist_folders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete project checklist folders"
  ON project_checklist_folders FOR DELETE
  TO authenticated
  USING (true);
