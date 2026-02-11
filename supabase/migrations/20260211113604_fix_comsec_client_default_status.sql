/*
  # Fix Com Sec Client Default Status

  1. Changes
    - Update all existing clients with null status_id to Hi-Po
    - Create trigger to automatically set status_id to Hi-Po on insert if null

  2. Purpose
    - Ensure all Com Sec clients have a valid status
    - New clients automatically start in Hi-Po status
*/

-- Update existing clients with null status to Hi-Po
DO $$
DECLARE
  v_comsec_project_id uuid;
  v_hipo_status_id uuid;
BEGIN
  -- Get Com Sec Project type ID
  SELECT id INTO v_comsec_project_id
  FROM project_types
  WHERE name = 'Com Sec';

  -- Get Hi-Po status ID for Com Sec
  SELECT id INTO v_hipo_status_id
  FROM statuses
  WHERE name = 'Hi-Po' 
    AND project_type_id = v_comsec_project_id
    AND is_substatus = false;

  -- Update existing records with null status to Hi-Po
  UPDATE comsec_clients
  SET status_id = v_hipo_status_id
  WHERE status_id IS NULL;
END $$;

-- Create function to set default status on insert
CREATE OR REPLACE FUNCTION set_comsec_default_status()
RETURNS TRIGGER AS $$
DECLARE
  v_comsec_project_id uuid;
  v_hipo_status_id uuid;
BEGIN
  -- Only set status if it's null
  IF NEW.status_id IS NULL THEN
    -- Get Com Sec Project type ID
    SELECT id INTO v_comsec_project_id
    FROM project_types
    WHERE name = 'Com Sec';

    -- Get Hi-Po status ID for Com Sec
    SELECT id INTO v_hipo_status_id
    FROM statuses
    WHERE name = 'Hi-Po' 
      AND project_type_id = v_comsec_project_id
      AND is_substatus = false;

    -- Set the status to Hi-Po
    NEW.status_id := v_hipo_status_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to set default status on insert
DROP TRIGGER IF EXISTS trigger_set_comsec_default_status ON comsec_clients;
CREATE TRIGGER trigger_set_comsec_default_status
  BEFORE INSERT ON comsec_clients
  FOR EACH ROW
  EXECUTE FUNCTION set_comsec_default_status();
