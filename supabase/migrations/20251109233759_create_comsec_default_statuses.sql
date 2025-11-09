/*
  # Create Default Statuses for Com Sec Project Type

  ## Overview
  Creates default workflow statuses for the Com Sec project type to enable proper functionality.

  ## New Statuses
  - Active - Companies currently being managed
  - Dormant - Inactive companies
  - Pending Renewal - Companies awaiting renewal
  - Completed - Finished engagements

  ## Notes
  - These statuses are specific to Com Sec workflow
  - Order index determines the display order in the UI
*/

-- Insert default statuses for Com Sec project type
INSERT INTO statuses (name, order_index, project_type_id, is_substatus, parent_status_id)
VALUES
  ('Active', 1, 'ca754beb-df54-45c1-a339-0e74790777d3', false, null),
  ('Dormant', 2, 'ca754beb-df54-45c1-a339-0e74790777d3', false, null),
  ('Pending Renewal', 3, 'ca754beb-df54-45c1-a339-0e74790777d3', false, null),
  ('Completed', 4, 'ca754beb-df54-45c1-a339-0e74790777d3', false, null)
ON CONFLICT DO NOTHING;