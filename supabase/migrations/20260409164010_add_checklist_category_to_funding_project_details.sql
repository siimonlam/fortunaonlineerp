/*
  # Add checklist_category to funding_project_details

  ## Summary
  Adds a `checklist_category` column to `funding_project_details` to link each
  project detail item to a category in the `funding_document_checklist` table.

  ## Changes
  - `funding_project_details`
    - Add `checklist_category` (text, nullable) — stores the category name that
      corresponds to entries in `funding_document_checklist.category`, allowing
      each project detail item to be associated with its relevant document checklist group.

  ## Notes
  - Stored as text (matching `funding_document_checklist.category` type) for
    simplicity and to avoid hard FK dependency on the checklist table.
  - Nullable so existing rows are unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funding_project_details'
    AND column_name = 'checklist_category'
  ) THEN
    ALTER TABLE funding_project_details
    ADD COLUMN checklist_category text;
  END IF;
END $$;
