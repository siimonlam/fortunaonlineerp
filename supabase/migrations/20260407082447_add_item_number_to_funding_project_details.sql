/*
  # Add item_number column to funding_project_details

  1. Changes
    - Add `item_number` (NUMERIC) column to `funding_project_details` table
    - This column tracks the line-item order from extracted PDF documents
    - Nullable to support existing records and manual entry

  2. Notes
    - Item numbers help maintain the original order from budget tables in PDF documents
    - Useful for AI extraction workflows where order matters
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funding_project_details' AND column_name = 'item_number'
  ) THEN
    ALTER TABLE funding_project_details ADD COLUMN item_number NUMERIC;
  END IF;
END $$;
