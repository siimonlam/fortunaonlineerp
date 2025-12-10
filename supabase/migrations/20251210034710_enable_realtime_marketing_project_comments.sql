/*
  # Enable Realtime for Marketing Project Comments

  1. Enable realtime replication for marketing_project_comments table
  2. Set replica identity to full for UPDATE events
*/

-- Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_project_comments;

-- Set replica identity to full for UPDATE events
ALTER TABLE marketing_project_comments REPLICA IDENTITY FULL;
