/*
  # Set Replica Identity for Marketing Facebook Accounts

  1. Changes
    - Set replica identity to full for `marketing_facebook_accounts` table
    - Allows complete change tracking for realtime updates

  2. Notes
    - Table already in realtime publication
*/

-- Set replica identity to full
ALTER TABLE marketing_facebook_accounts REPLICA IDENTITY FULL;