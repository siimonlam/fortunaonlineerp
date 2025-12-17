/*
  # Sync client_number to Instagram accounts from marketing projects
  
  1. Changes
    - Create trigger function to sync client_number from marketing_projects.parent_client_id to instagram_accounts
    - When an Instagram account is linked to a marketing project, populate the client_number
    - Update existing linked accounts with their project's client_number
  
  2. Purpose
    - Enable filtering of Instagram posts and metrics by client_number
    - Maintain data consistency between marketing projects and Instagram accounts
*/

-- Create function to sync client_number when Instagram account is linked to a marketing project
CREATE OR REPLACE FUNCTION sync_instagram_client_number_from_project()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new link is created, update the instagram_account with the project's parent_client_id
  IF TG_OP = 'INSERT' THEN
    UPDATE instagram_accounts
    SET client_number = (
      SELECT parent_client_id
      FROM marketing_projects
      WHERE id = NEW.marketing_project_id
    )
    WHERE account_id = NEW.account_id;
  END IF;
  
  -- When a link is deleted, set client_number to NULL (account is no longer linked)
  IF TG_OP = 'DELETE' THEN
    UPDATE instagram_accounts
    SET client_number = NULL
    WHERE account_id = OLD.account_id
    AND NOT EXISTS (
      -- Only clear if this was the last project link
      SELECT 1 FROM marketing_project_instagram_accounts
      WHERE account_id = OLD.account_id
      AND marketing_project_id != OLD.marketing_project_id
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on marketing_project_instagram_accounts
DROP TRIGGER IF EXISTS sync_instagram_client_number_trigger ON marketing_project_instagram_accounts;
CREATE TRIGGER sync_instagram_client_number_trigger
  AFTER INSERT OR DELETE ON marketing_project_instagram_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_instagram_client_number_from_project();

-- Update existing Instagram accounts with client_number from their linked marketing projects
UPDATE instagram_accounts ia
SET client_number = mp.parent_client_id
FROM marketing_project_instagram_accounts mpia
JOIN marketing_projects mp ON mpia.marketing_project_id = mp.id
WHERE ia.account_id = mpia.account_id
AND mp.parent_client_id IS NOT NULL;