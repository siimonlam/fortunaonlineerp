/*
  # Remove Unused Com Sec Statuses

  1. Changes
    - Remove "Dormant" and "Completed" statuses from Com Sec
    - Keep only: Hi-Po, Active, Pending Renewal

  2. Safety
    - Migrate any clients using removed statuses to Hi-Po
    - Then delete the unused statuses
*/

DO $$
DECLARE
  v_comsec_project_id uuid;
  v_hipo_status_id uuid;
  v_dormant_status_id uuid;
  v_completed_status_id uuid;
BEGIN
  -- Get Com Sec Project type ID
  SELECT id INTO v_comsec_project_id
  FROM project_types
  WHERE name = 'Com Sec';

  -- Get status IDs
  SELECT id INTO v_hipo_status_id
  FROM statuses
  WHERE name = 'Hi-Po' 
    AND project_type_id = v_comsec_project_id;

  SELECT id INTO v_dormant_status_id
  FROM statuses
  WHERE name = 'Dormant' 
    AND project_type_id = v_comsec_project_id;

  SELECT id INTO v_completed_status_id
  FROM statuses
  WHERE name = 'Completed' 
    AND project_type_id = v_comsec_project_id;

  -- Migrate any clients using Dormant or Completed to Hi-Po
  UPDATE comsec_clients
  SET status_id = v_hipo_status_id
  WHERE status_id IN (v_dormant_status_id, v_completed_status_id);

  -- Delete the unused statuses
  DELETE FROM statuses 
  WHERE id IN (v_dormant_status_id, v_completed_status_id)
    AND project_type_id = v_comsec_project_id;
END $$;
