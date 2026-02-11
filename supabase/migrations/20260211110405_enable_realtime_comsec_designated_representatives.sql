/*
  # Enable Realtime for Designated Representatives Table

  1. Changes
    - Enable realtime replication for comsec_designated_representatives table
    - Set replica identity to FULL for complete change tracking

  2. Purpose
    - Allow real-time updates to be reflected across all connected clients
    - Ensure complete row data is available in realtime events
*/

-- Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE comsec_designated_representatives;

-- Set replica identity to FULL to include all column values in realtime events
ALTER TABLE comsec_designated_representatives REPLICA IDENTITY FULL;