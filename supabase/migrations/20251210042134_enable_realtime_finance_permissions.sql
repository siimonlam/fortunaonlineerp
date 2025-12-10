/*
  # Enable Realtime for Finance Permissions

  1. Changes
    - Enable realtime replication for finance_permissions table
    - Set replica identity to full for complete change tracking
    
  2. Purpose
    - Allow users to see invoice action buttons immediately when finance permissions are granted
    - No need to close/reopen modal or refresh page
*/

-- Enable realtime for finance_permissions table
ALTER PUBLICATION supabase_realtime ADD TABLE finance_permissions;

-- Set replica identity to full to track all column changes
ALTER TABLE finance_permissions REPLICA IDENTITY FULL;
