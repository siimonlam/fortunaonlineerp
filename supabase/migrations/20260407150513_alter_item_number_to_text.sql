/*
  # Alter item_number column to TEXT in funding_project_details

  1. Changes
    - ALTER `item_number` column from NUMERIC to TEXT
    - This allows storing composite strings like "FP00458&001"
    - Existing numeric values are cast to text automatically

  2. Notes
    - Item numbers now follow the format: {project_reference}&{3-digit-index}
    - e.g. "FP00458&001", "FP00458&002"
*/

ALTER TABLE funding_project_details
  ALTER COLUMN item_number TYPE TEXT USING item_number::TEXT;
