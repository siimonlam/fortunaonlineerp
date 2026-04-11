/*
  # Add checklist_folder_id to projects

  Stores the Google Drive folder ID of the created checklist folder structure,
  so the "Create Checklist Folders" button can be greyed out when it already exists.

  1. Changes
    - `projects`: add `checklist_folder_id` (text, nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'checklist_folder_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN checklist_folder_id text;
  END IF;
END $$;
