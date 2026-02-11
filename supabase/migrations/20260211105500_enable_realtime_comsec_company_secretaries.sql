/*
  # Enable Realtime for Company Secretaries Table

  1. Changes
    - Enable realtime replication for comsec_company_secretaries table
    - Set replica identity to FULL for complete change tracking

  2. Purpose
    - Allow real-time updates to be reflected across all connected clients
    - Ensure complete row data is available in realtime events
*/

-- Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE comsec_company_secretaries;

-- Set replica identity to FULL to include all column values in realtime events
ALTER TABLE comsec_company_secretaries REPLICA IDENTITY FULL;