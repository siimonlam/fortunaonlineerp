/*
  # Add Hi-Po Status to Com Sec Project Type

  1. Changes
    - Add "Hi-Po" as the first status for Com Sec project type
    - Reorder existing statuses to make room for Hi-Po at the beginning

  2. Purpose
    - Allow new Com Sec projects to start in Hi-Po status
    - Match the workflow pattern used in Funding Projects
*/

-- Get the Com Sec project type ID
DO $$
DECLARE
  v_comsec_project_id uuid;
BEGIN
  -- Get Com Sec Project type ID
  SELECT id INTO v_comsec_project_id
  FROM project_types
  WHERE name = 'Com Sec';

  -- Shift existing statuses' order_index by 1 to make room for Hi-Po
  UPDATE statuses
  SET order_index = order_index + 1
  WHERE project_type_id = v_comsec_project_id;

  -- Insert Hi-Po status as the first status (order_index = 1)
  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
  VALUES ('Hi-Po', v_comsec_project_id, NULL, 1, false)
  ON CONFLICT DO NOTHING;
END $$;
