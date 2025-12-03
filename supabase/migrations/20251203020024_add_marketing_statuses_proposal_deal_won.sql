/*
  # Add Marketing Statuses

  1. Purpose
    - Add "Proposal" and "Deal won" statuses for Marketing project type
    - Ensure Marketing has 3 statuses: Hi-Po (default), Proposal, Deal won

  2. New Statuses
    - Proposal - For marketing projects in proposal stage
    - Deal won - For marketing projects that won the deal

  3. Notes
    - Using IF NOT EXISTS to prevent duplicates
    - Hi-Po status already exists as the default
*/

-- Get the Marketing project type ID
DO $$
DECLARE
  v_marketing_type_id uuid;
BEGIN
  SELECT id INTO v_marketing_type_id
  FROM project_types
  WHERE name = 'Marketing';

  -- Add "Proposal" status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM statuses
    WHERE name = 'Proposal' AND project_type_id = v_marketing_type_id
  ) THEN
    INSERT INTO statuses (name, project_type_id, order_index)
    VALUES ('Proposal', v_marketing_type_id, 2);
  END IF;

  -- Add "Deal won" status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM statuses
    WHERE name = 'Deal won' AND project_type_id = v_marketing_type_id
  ) THEN
    INSERT INTO statuses (name, project_type_id, order_index)
    VALUES ('Deal won', v_marketing_type_id, 3);
  END IF;
END $$;
