/*
  # Enable Realtime for Marketing Project Buttons

  1. Changes
    - Enable realtime replication for marketing_project_buttons table
    - Set replica identity to full for complete change tracking
*/

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_project_buttons;

-- Set replica identity to full to get all column values in realtime events
ALTER TABLE marketing_project_buttons REPLICA IDENTITY FULL;
