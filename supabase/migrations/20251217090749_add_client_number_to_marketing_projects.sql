/*
  # Add Client Number to Marketing Projects

  1. Changes
    - Add `client_number` column to marketing_projects table to store the parent client's client_number (C0008 format)
    - Create function to automatically populate client_number when parent_client_id is set
    - Create trigger to execute the function on INSERT and UPDATE
    - Backfill existing records that have a parent_client_id

  2. Purpose
    - Enable easy filtering and tracking of marketing projects by client number
    - Maintain consistency with the client numbering system
*/

-- Add client_number column to marketing_projects
ALTER TABLE marketing_projects
ADD COLUMN IF NOT EXISTS client_number text;

-- Function to sync client_number from parent client
CREATE OR REPLACE FUNCTION sync_marketing_project_client_number()
RETURNS TRIGGER AS $$
BEGIN
  -- If parent_client_id is provided, get the client_number from clients table
  IF NEW.parent_client_id IS NOT NULL THEN
    NEW.client_number := (
      SELECT client_number
      FROM clients
      WHERE id::text = NEW.parent_client_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync client_number
DROP TRIGGER IF EXISTS trigger_sync_marketing_project_client_number ON marketing_projects;

CREATE TRIGGER trigger_sync_marketing_project_client_number
  BEFORE INSERT OR UPDATE ON marketing_projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_marketing_project_client_number();

-- Backfill existing records
UPDATE marketing_projects mp
SET client_number = c.client_number
FROM clients c
WHERE mp.parent_client_id IS NOT NULL
  AND c.id::text = mp.parent_client_id
  AND mp.client_number IS NULL;