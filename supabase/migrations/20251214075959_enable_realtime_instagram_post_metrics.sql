/*
  # Enable Realtime for Instagram Post Metrics

  1. Changes
    - Enable realtime replication for `instagram_post_metrics` table
    - Set replica identity to FULL to track all changes
*/

ALTER PUBLICATION supabase_realtime ADD TABLE instagram_post_metrics;

ALTER TABLE instagram_post_metrics REPLICA IDENTITY FULL;
