/*
  # Enable Realtime for Instagram Accounts

  1. Changes
    - Enable realtime replication for `instagram_accounts` table
    - Set replica identity to FULL to track all changes
*/

ALTER PUBLICATION supabase_realtime ADD TABLE instagram_accounts;

ALTER TABLE instagram_accounts REPLICA IDENTITY FULL;
