/*
  # Add Industry Field to Clients Table

  1. Changes
    - Add `industry` column to `clients` table
    - Column is optional (nullable) text field
    
  2. Notes
    - Allows tracking client industry information
    - Default value is NULL for existing clients
*/

-- Add industry field to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'industry'
  ) THEN
    ALTER TABLE clients ADD COLUMN industry text;
  END IF;
END $$;
