/*
  # Add google_file_id to project_checklist_file_checks

  1. Changes
    - Add `google_file_id` (text) column to `project_checklist_file_checks`
      - Stores the Google Drive file ID from the parent `project_checklist_files.file_id`
      - Nullable to support existing rows

  2. Backfill
    - Populate `google_file_id` for all existing rows by joining to `project_checklist_files`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_file_checks' AND column_name = 'google_file_id'
  ) THEN
    ALTER TABLE project_checklist_file_checks ADD COLUMN google_file_id text;
  END IF;
END $$;

UPDATE project_checklist_file_checks c
SET google_file_id = f.file_id
FROM project_checklist_files f
WHERE c.file_id = f.id
  AND c.google_file_id IS NULL
  AND f.file_id IS NOT NULL;
