/*
  # Enable Realtime for Marketing Project Instagram Accounts

  1. Changes
    - Enable realtime replication for marketing_project_instagram_accounts table
    - Set replica identity to full for complete change tracking
*/

ALTER PUBLICATION supabase_realtime ADD TABLE marketing_project_instagram_accounts;

ALTER TABLE marketing_project_instagram_accounts REPLICA IDENTITY FULL;
