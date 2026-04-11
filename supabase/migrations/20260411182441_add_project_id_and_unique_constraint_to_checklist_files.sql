
/*
  # Add project_id to project_checklist_files and enforce uniqueness

  1. Changes
    - Add `project_id` column to `project_checklist_files`
    - Backfill `project_id` from the linked `project_checklist_items` row
    - Add unique constraint on (file_id, drive_folder_id) to prevent duplicate file rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_files' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE project_checklist_files ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE project_checklist_files pcf
SET project_id = pci.project_id
FROM project_checklist_items pci
WHERE pcf.checklist_item_id = pci.id
  AND pcf.project_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_checklist_files_file_id_drive_folder_id_key'
  ) THEN
    ALTER TABLE project_checklist_files
      ADD CONSTRAINT project_checklist_files_file_id_drive_folder_id_key
      UNIQUE (file_id, drive_folder_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_checklist_files_project_id
  ON project_checklist_files(project_id);
