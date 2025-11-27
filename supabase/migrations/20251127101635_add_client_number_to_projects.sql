/*
  # Add client_number field to projects table

  1. Changes
    - Add `client_number` column to projects table to store the formatted client ID (e.g., C0004)
    - Create trigger to automatically sync client_number when client_id is set or updated
    - Backfill existing projects with their client_number

  2. Benefits
    - Display human-readable client IDs in projects
    - Automatic synchronization with clients table
    - No need to manually update client_number
*/

-- Add client_number column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS client_number TEXT;

-- Create function to sync client_number from clients table
CREATE OR REPLACE FUNCTION sync_project_client_number()
RETURNS TRIGGER AS $$
BEGIN
  -- If client_id is set, get the client_number from clients table
  IF NEW.client_id IS NOT NULL THEN
    SELECT client_number INTO NEW.client_number
    FROM clients
    WHERE id = NEW.client_id;
  ELSE
    NEW.client_number := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS sync_project_client_number_trigger ON projects;

-- Create trigger to automatically sync client_number on insert/update
CREATE TRIGGER sync_project_client_number_trigger
  BEFORE INSERT OR UPDATE OF client_id ON projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_client_number();

-- Backfill existing projects with client_number
UPDATE projects p
SET client_number = c.client_number
FROM clients c
WHERE p.client_id = c.id
  AND p.client_number IS NULL;
