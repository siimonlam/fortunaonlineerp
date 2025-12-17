/*
  # Fix Marketing Project Client Number Logic

  1. Changes
    - Update the trigger function to handle parent_client_id storing client_number directly
    - Backfill existing records properly

  2. Notes
    - parent_client_id stores the client_number (e.g., "C0625"), not the UUID
*/

-- Update function to handle parent_client_id = client_number
CREATE OR REPLACE FUNCTION sync_marketing_project_client_number()
RETURNS TRIGGER AS $$
BEGIN
  -- parent_client_id already contains the client_number, just copy it
  IF NEW.parent_client_id IS NOT NULL THEN
    NEW.client_number := NEW.parent_client_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing records
UPDATE marketing_projects
SET client_number = parent_client_id
WHERE parent_client_id IS NOT NULL
  AND client_number IS NULL;