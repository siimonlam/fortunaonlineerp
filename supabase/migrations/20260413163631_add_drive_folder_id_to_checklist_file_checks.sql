/*
  # Add drive_folder_id to project_checklist_file_checks

  ## Summary
  Adds a `drive_folder_id` column to `project_checklist_file_checks` so each
  check row knows which Google Drive folder its source file came from.

  ## Changes
  ### Modified Tables
  - `project_checklist_file_checks`
    - New column: `drive_folder_id` (text, nullable) — the Google Drive folder ID
      that the associated file lives in. Populated at row creation by the
      sync-checklist-files edge function.

  ## Backfill
  Existing rows are back-filled from the parent `project_checklist_files` row
  so historical data is consistent.

  ## Notes
  - Nullable to avoid breaking existing rows that predate this migration.
  - No RLS change needed — the column carries no access-control semantics.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_file_checks'
      AND column_name = 'drive_folder_id'
  ) THEN
    ALTER TABLE project_checklist_file_checks
      ADD COLUMN drive_folder_id text;
  END IF;
END $$;

-- Back-fill from the linked project_checklist_files row
UPDATE project_checklist_file_checks c
SET drive_folder_id = f.drive_folder_id
FROM project_checklist_files f
WHERE c.file_id = f.id
  AND c.drive_folder_id IS NULL
  AND f.drive_folder_id IS NOT NULL;

-- Index for lookups by folder
CREATE INDEX IF NOT EXISTS idx_pcfc_drive_folder_id
  ON project_checklist_file_checks (drive_folder_id);
