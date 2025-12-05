/*
  # Add extracted_data column to scan_sessions table

  1. Changes
    - Add `extracted_data` (jsonb) column to `scan_sessions` table
    - This will store the business card data extracted from the scanned image

  2. Notes
    - JSONB format allows flexible storage of business card fields
    - Fields may include: company_name, contact_name, email, phone, address, website
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_sessions' AND column_name = 'extracted_data'
  ) THEN
    ALTER TABLE scan_sessions ADD COLUMN extracted_data jsonb;
  END IF;
END $$;
