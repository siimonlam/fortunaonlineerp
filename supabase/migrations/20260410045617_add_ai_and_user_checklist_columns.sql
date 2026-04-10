/*
  # Enhance project_checklist_items with AI and user tracking columns

  ## Summary
  Adds four new columns to project_checklist_items to support dual-checkbox tracking
  (AI check + human check) and data storage fields for both AI-extracted and user-entered data.

  ## Changes to project_checklist_items
  - `is_checked_by_ai` (boolean) — whether AI has verified this criterion
  - `ai_checked_at` (timestamptz) — when AI checked it
  - `is_checked` — renamed concept: now specifically tracks the human user check
  - `checked_by_user_name` (text) — denormalized display name of the user who checked it
  - `data` (text) — general/user-entered data for this criterion (e.g., notes or extracted values)
  - `data_by_ai` (text) — AI-extracted data for this criterion (e.g., a date read from a document)

  ## Important Notes
  - Existing `checked_by` (uuid) and `checked_at` columns are kept for backward compatibility
  - `checked_by_user_name` is stored denormalized so display does not require a join to auth.users
  - All new columns are nullable — no data loss for existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_items' AND column_name = 'is_checked_by_ai'
  ) THEN
    ALTER TABLE project_checklist_items ADD COLUMN is_checked_by_ai boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_items' AND column_name = 'ai_checked_at'
  ) THEN
    ALTER TABLE project_checklist_items ADD COLUMN ai_checked_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_items' AND column_name = 'checked_by_user_name'
  ) THEN
    ALTER TABLE project_checklist_items ADD COLUMN checked_by_user_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_items' AND column_name = 'data'
  ) THEN
    ALTER TABLE project_checklist_items ADD COLUMN data text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_items' AND column_name = 'data_by_ai'
  ) THEN
    ALTER TABLE project_checklist_items ADD COLUMN data_by_ai text;
  END IF;
END $$;
