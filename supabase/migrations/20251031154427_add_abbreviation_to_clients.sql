/*
  # Add Abbreviation Field to Clients Table

  1. Changes
    - Add `abbreviation` column to `clients` table
    - Column is optional (nullable) text field
    
  2. Notes
    - Allows tracking client abbreviation for easier identification
    - Default value is NULL for existing clients
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'abbreviation'
  ) THEN
    ALTER TABLE clients ADD COLUMN abbreviation text;
  END IF;
END $$;
