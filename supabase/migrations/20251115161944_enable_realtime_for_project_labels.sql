/*
  # Enable real-time replication for project_labels table

  1. Changes
    - Add project_labels to the supabase_realtime publication
    - Set replica identity to FULL for project_labels to enable real-time updates
    
  2. Purpose
    - Allow real-time updates when labels are added/removed from projects
    - Ensures UI updates immediately without page reload
*/

-- Enable realtime for project_labels
ALTER PUBLICATION supabase_realtime ADD TABLE project_labels;

-- Set replica identity to FULL to include all column values in realtime events
ALTER TABLE project_labels REPLICA IDENTITY FULL;
