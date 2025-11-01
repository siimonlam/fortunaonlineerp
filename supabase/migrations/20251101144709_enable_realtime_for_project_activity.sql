/*
  # Enable Realtime for Project Activity Tables

  1. Changes
    - Add project_history and project_comments to realtime publication
    - Set replica identity to FULL for both tables
    
  2. Purpose
    - Enable real-time updates for comments and history
    - Allow multiple users to see changes instantly
*/

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE project_history;
ALTER PUBLICATION supabase_realtime ADD TABLE project_comments;

-- Set replica identity to FULL to include all column values in replication
ALTER TABLE project_history REPLICA IDENTITY FULL;
ALTER TABLE project_comments REPLICA IDENTITY FULL;
