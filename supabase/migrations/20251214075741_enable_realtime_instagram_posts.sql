/*
  # Enable Realtime for Instagram Posts

  1. Changes
    - Enable realtime replication for `instagram_posts` table
    - Set replica identity to FULL to track all changes
*/

ALTER PUBLICATION supabase_realtime ADD TABLE instagram_posts;

ALTER TABLE instagram_posts REPLICA IDENTITY FULL;
