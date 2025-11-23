/*
  # Add remark field to funding_invoice table

  1. Changes
    - Add `remark` column to `funding_invoice` table to store payment remarks
  
  2. Details
    - Column type: text (allows storing detailed payment remarks)
    - Nullable: true (remarks are optional)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funding_invoice' AND column_name = 'remark'
  ) THEN
    ALTER TABLE funding_invoice ADD COLUMN remark text;
  END IF;
END $$;