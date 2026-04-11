/*
  # Add file_id column to project_checklist_files

  ## Summary
  The sync-from-Drive workflow needs to track the Google Drive file ID separately
  from the file_url so the system can deduplicate: before inserting a new file record
  it checks whether a row with the same (checklist_item_id, file_id) already exists.

  ## Changes

  ### Modified Tables: `project_checklist_files`
  - Added `file_id` (text, nullable) — stores the Google Drive file ID (e.g. "1aBcD…")
    Nullable so existing rows (uploaded via storage URL) are unaffected.

  ## Indexes
  - `idx_project_checklist_files_file_id` on `file_id` for fast duplicate checks
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_files' AND column_name = 'file_id'
  ) THEN
    ALTER TABLE project_checklist_files ADD COLUMN file_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_checklist_files_file_id
  ON project_checklist_files(file_id);
