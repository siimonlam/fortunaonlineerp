/*
  # Add Hi-Po Substatuses

  1. New Substatuses
    - Add four new substatuses under Hi-Po main status:
      - Hi-Po (substatus)
      - Mi-Po
      - Lo-Po
      - Cold Call
    
  2. Details
    - All substatuses are linked to the Hi-Po parent status
    - These statuses allow better categorization of potential projects
    - Each substatus represents a different priority level or engagement stage
    - Order indices are set sequentially starting from 10

  3. Notes
    - Hi-Po substatus shares the same name as parent but has different hierarchy level
    - This follows the existing pattern seen in other status groups
*/

-- Get the Hi-Po parent status ID and Funding Project type ID
DO $$
DECLARE
  v_hipo_parent_id uuid;
  v_funding_project_id uuid;
  v_next_order int;
BEGIN
  -- Get Funding Project type ID
  SELECT id INTO v_funding_project_id
  FROM project_types
  WHERE name = 'Funding Project';

  -- Get Hi-Po parent status ID
  SELECT id INTO v_hipo_parent_id
  FROM statuses
  WHERE name = 'Hi-Po' 
    AND parent_status_id IS NULL 
    AND project_type_id = v_funding_project_id;

  -- Get next available order index
  SELECT COALESCE(MAX(order_index), 9) + 1 INTO v_next_order
  FROM statuses
  WHERE project_type_id = v_funding_project_id;

  -- Insert Hi-Po substatuses if they don't exist
  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index)
  SELECT 'Hi-Po', v_funding_project_id, v_hipo_parent_id, v_next_order
  WHERE NOT EXISTS (
    SELECT 1 FROM statuses 
    WHERE name = 'Hi-Po' 
      AND parent_status_id = v_hipo_parent_id
  );

  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index)
  SELECT 'Mi-Po', v_funding_project_id, v_hipo_parent_id, v_next_order + 1
  WHERE NOT EXISTS (
    SELECT 1 FROM statuses 
    WHERE name = 'Mi-Po' 
      AND parent_status_id = v_hipo_parent_id
  );

  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index)
  SELECT 'Lo-Po', v_funding_project_id, v_hipo_parent_id, v_next_order + 2
  WHERE NOT EXISTS (
    SELECT 1 FROM statuses 
    WHERE name = 'Lo-Po' 
      AND parent_status_id = v_hipo_parent_id
  );

  INSERT INTO statuses (name, project_type_id, parent_status_id, order_index)
  SELECT 'Cold Call', v_funding_project_id, v_hipo_parent_id, v_next_order + 3
  WHERE NOT EXISTS (
    SELECT 1 FROM statuses 
    WHERE name = 'Cold Call' 
      AND parent_status_id = v_hipo_parent_id
  );
END $$;
