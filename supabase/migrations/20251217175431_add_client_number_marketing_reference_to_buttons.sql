/*
  # Add client_number and marketing_reference to marketing_project_buttons

  1. Changes
    - Add `client_number` column to marketing_project_buttons
    - Add `marketing_reference` column to marketing_project_buttons
    - Populate these fields from linked marketing_projects
    - Create trigger to auto-populate these fields on insert/update

  2. Purpose
    - When accounts are added to marketing buttons, they can inherit client_number and marketing_reference
    - Maintains consistency across marketing projects, buttons, and social accounts
*/

-- Add columns to marketing_project_buttons
ALTER TABLE marketing_project_buttons
ADD COLUMN IF NOT EXISTS client_number text,
ADD COLUMN IF NOT EXISTS marketing_reference text;

-- Populate existing records from marketing_projects
UPDATE marketing_project_buttons mpb
SET 
  client_number = mp.client_number,
  marketing_reference = mp.project_reference
FROM marketing_projects mp
WHERE mpb.marketing_project_id = mp.id
  AND (mpb.client_number IS NULL OR mpb.marketing_reference IS NULL);

-- Create function to auto-populate on insert/update
CREATE OR REPLACE FUNCTION sync_button_client_info()
RETURNS TRIGGER AS $$
BEGIN
  -- Get client_number and marketing_reference from marketing_projects
  SELECT client_number, project_reference
  INTO NEW.client_number, NEW.marketing_reference
  FROM marketing_projects
  WHERE id = NEW.marketing_project_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS sync_button_client_info_trigger ON marketing_project_buttons;
CREATE TRIGGER sync_button_client_info_trigger
  BEFORE INSERT OR UPDATE ON marketing_project_buttons
  FOR EACH ROW
  EXECUTE FUNCTION sync_button_client_info();
