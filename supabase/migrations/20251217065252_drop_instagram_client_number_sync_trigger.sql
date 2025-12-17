/*
  # Drop Instagram Client Number Sync Trigger
  
  1. Changes
    - Drop the trigger that syncs client_number from marketing_projects to instagram_accounts
    - Drop the associated function
  
  2. Reason
    - Marketing projects don't have a client_number column
    - The relationship is tracked via the junction table marketing_project_instagram_accounts
    - Client number tracking isn't needed for Instagram accounts in marketing projects
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_sync_instagram_account_client_number ON marketing_project_instagram_accounts;

-- Drop the function
DROP FUNCTION IF EXISTS sync_instagram_account_client_number();
