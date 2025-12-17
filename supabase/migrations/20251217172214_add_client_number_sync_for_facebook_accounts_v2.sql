/*
  # Sync client_number to Facebook accounts from marketing projects
  
  1. Changes
    - Create trigger function to sync client_number from marketing_projects to facebook_accounts
    - When a Facebook account is linked to a marketing project, populate the client_number
    - Update existing linked accounts with their project's client_number
  
  2. Purpose
    - Enable filtering of Facebook posts and metrics by client_number
    - Maintain data consistency between marketing projects and Facebook accounts
*/

-- Create function to sync client_number when Facebook account is linked to a marketing project
CREATE OR REPLACE FUNCTION sync_facebook_client_number_from_project()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new link is created, update the facebook_account with the project's client_number
  IF TG_OP = 'INSERT' THEN
    UPDATE facebook_accounts
    SET client_number = (
      SELECT client_number
      FROM marketing_projects
      WHERE project_reference = NEW.marketing_reference
    )
    WHERE page_id = NEW.page_id;
  END IF;
  
  -- When a link is deleted, set client_number to NULL (account is no longer linked)
  IF TG_OP = 'DELETE' THEN
    UPDATE facebook_accounts
    SET client_number = NULL
    WHERE page_id = OLD.page_id
    AND NOT EXISTS (
      -- Only clear if this was the last project link
      SELECT 1 FROM marketing_facebook_accounts
      WHERE page_id = OLD.page_id
      AND marketing_reference != OLD.marketing_reference
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on marketing_facebook_accounts
DROP TRIGGER IF EXISTS sync_facebook_client_number_trigger ON marketing_facebook_accounts;
CREATE TRIGGER sync_facebook_client_number_trigger
  AFTER INSERT OR DELETE ON marketing_facebook_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_facebook_client_number_from_project();

-- Update existing Facebook accounts with client_number from their linked marketing projects
UPDATE facebook_accounts fa
SET client_number = mp.client_number
FROM marketing_facebook_accounts mfa
JOIN marketing_projects mp ON mfa.marketing_reference = mp.project_reference
WHERE fa.page_id = mfa.page_id
AND mp.client_number IS NOT NULL;