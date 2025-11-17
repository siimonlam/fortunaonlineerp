/*
  # Create Marketing Project Statuses

  1. New Statuses for Marketing Project Type
    - Hi-Po (parent status, order 1)
      - Hi-Po (substatus, under parent Hi-Po)
      - Mi-Po (substatus, under parent Hi-Po)
      - Lo-Po (substatus, under parent Hi-Po)
      - Cold Call (substatus, under parent Hi-Po)
    
  2. Details
    - All substatuses are linked to the Hi-Po parent status
    - Similar structure to Funding Project Hi-Po statuses
    - Allows categorization of marketing projects by potential
    
  3. Security
    - Uses existing RLS policies on statuses table
*/

DO $$
DECLARE
  v_marketing_project_id uuid;
  v_hipo_parent_id uuid;
  v_next_order integer;
BEGIN
  -- Get Marketing project type ID
  SELECT id INTO v_marketing_project_id
  FROM project_types
  WHERE name = 'Marketing';

  -- Insert Hi-Po parent status for Marketing if it doesn't exist
  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
  VALUES ('Hi-Po', v_marketing_project_id, NULL, 1, false)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_hipo_parent_id;

  -- If status already exists, get its ID
  IF v_hipo_parent_id IS NULL THEN
    SELECT id INTO v_hipo_parent_id
    FROM statuses
    WHERE name = 'Hi-Po' 
      AND parent_status_id IS NULL 
      AND project_type_id = v_marketing_project_id;
  END IF;

  -- Get the next available order index for substatuses
  SELECT COALESCE(MAX(order_index), 0) + 1 INTO v_next_order
  FROM statuses
  WHERE project_type_id = v_marketing_project_id;

  -- Insert Hi-Po substatus if it doesn't exist
  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
  SELECT 'Hi-Po', v_marketing_project_id, v_hipo_parent_id, v_next_order, true
  WHERE NOT EXISTS (
    SELECT 1 FROM statuses 
    WHERE name = 'Hi-Po' 
      AND parent_status_id = v_hipo_parent_id
  );

  -- Insert Mi-Po substatus if it doesn't exist
  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
  SELECT 'Mi-Po', v_marketing_project_id, v_hipo_parent_id, v_next_order + 1, true
  WHERE NOT EXISTS (
    SELECT 1 FROM statuses 
    WHERE name = 'Mi-Po' 
      AND parent_status_id = v_hipo_parent_id
  );

  -- Insert Lo-Po substatus if it doesn't exist
  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
  SELECT 'Lo-Po', v_marketing_project_id, v_hipo_parent_id, v_next_order + 2, true
  WHERE NOT EXISTS (
    SELECT 1 FROM statuses 
    WHERE name = 'Lo-Po' 
      AND parent_status_id = v_hipo_parent_id
  );

  -- Insert Cold Call substatus if it doesn't exist
  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index, is_substatus)
  SELECT 'Cold Call', v_marketing_project_id, v_hipo_parent_id, v_next_order + 3, true
  WHERE NOT EXISTS (
    SELECT 1 FROM statuses 
    WHERE name = 'Cold Call' 
      AND parent_status_id = v_hipo_parent_id
  );

END $$;
