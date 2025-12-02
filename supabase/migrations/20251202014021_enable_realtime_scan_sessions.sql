/*
  # Enable Realtime for Scan Sessions

  1. Changes
    - Enable realtime replication for scan_sessions table
    - Set replica identity to full for complete change tracking

  2. Notes
    - Required for real-time sync between phone and desktop
*/

ALTER PUBLICATION supabase_realtime ADD TABLE scan_sessions;

ALTER TABLE scan_sessions REPLICA IDENTITY FULL;
