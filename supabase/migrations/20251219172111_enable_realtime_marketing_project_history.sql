/*
  # Enable Realtime for Marketing Project History

  1. Changes
    - Enable realtime replication for marketing_project_history table
    - Set replica identity to FULL to allow proper realtime updates
    
  2. Impact
    - UI can receive live updates when marketing project history changes
    - Activity feeds will update in real-time
*/

-- Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_project_history;

-- Set replica identity to FULL for better realtime support
ALTER TABLE marketing_project_history REPLICA IDENTITY FULL;
