/*
  # Add item_grant_amount to funding_project_details

  ## Summary
  Adds a new column `item_grant_amount` to the `funding_project_details` table.

  ## Changes
  - `funding_project_details`
    - New column: `item_grant_amount` (numeric, nullable) — stores the grant amount for an individual 細項 (line item) within a sub-project. When a sub-project has multiple items, the parent "Detail" row leaves this null, and each child item row carries its own amount.

  ## Notes
  - Nullable so existing rows are not affected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funding_project_details' AND column_name = 'item_grant_amount'
  ) THEN
    ALTER TABLE funding_project_details ADD COLUMN item_grant_amount numeric;
  END IF;
END $$;
