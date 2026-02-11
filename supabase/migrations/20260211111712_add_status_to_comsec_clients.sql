/*
  # Add Status Field to Com Sec Clients

  1. Changes
    - Add status_id field to comsec_clients table
    - Link to statuses table for Com Sec project type
    - Migrate existing clients to Hi-Po status

  2. Purpose
    - Enable status tracking for Com Sec clients
    - Support workflow: Hi-Po -> Active (Clients) -> Pending Renewal
*/

-- Add status_id column to comsec_clients
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

  -- Add status_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_clients' AND column_name = 'status_id'
  ) THEN
    ALTER TABLE comsec_clients 
    ADD COLUMN status_id uuid REFERENCES statuses(id);
  END IF;

  -- Update existing records to Hi-Po status
  UPDATE comsec_clients
  SET status_id = v_hipo_status_id
  WHERE status_id IS NULL;
END $$;
