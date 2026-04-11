/*
  # Add drive_folder_id to project_checklist_items

  ## Summary
  Each checklist item (e.g. "Quotations", "Invoice") can be linked to a specific
  Google Drive folder. The sync-checklist-files Edge Function uses this folder ID
  to discover new files and send them to n8n for AI processing.

  ## Changes

  ### Modified Tables: `project_checklist_items`
  - Added `drive_folder_id` (text, nullable) — the Google Drive folder ID that
    contains the actual documents for this checklist requirement.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_items' AND column_name = 'drive_folder_id'
  ) THEN
    ALTER TABLE project_checklist_items ADD COLUMN drive_folder_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_checklist_items_drive_folder_id
  ON project_checklist_items(drive_folder_id)
  WHERE drive_folder_id IS NOT NULL;
