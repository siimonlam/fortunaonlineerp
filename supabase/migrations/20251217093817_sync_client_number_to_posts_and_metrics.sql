/*
  # Update Instagram Sync Functions for Both Client Number and Marketing Reference

  1. Changes
    - Update sync_instagram_client_number_from_project to sync both client_number and marketing_reference
    - Update sync_post_client_number_from_account to sync both fields to posts
    - Update sync_metric_client_number_from_account to sync both fields to metrics
    - Add trigger to cascade updates when instagram_accounts fields change

  2. Purpose
    - Ensure both client_number (C0xxx) and marketing_reference (MP0xxx) are always in sync
*/

-- Update the function that syncs from marketing project to instagram_accounts
CREATE OR REPLACE FUNCTION sync_instagram_client_number_from_project()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new link is created, update the instagram_account with both client_number and marketing_reference
  IF TG_OP = 'INSERT' THEN
    UPDATE instagram_accounts
    SET 
      client_number = (
        SELECT client_number
        FROM marketing_projects
        WHERE id = NEW.marketing_project_id
      ),
      marketing_reference = (
        SELECT project_reference
        FROM marketing_projects
        WHERE id = NEW.marketing_project_id
      )
    WHERE account_id = NEW.account_id;
  END IF;

  -- When a link is deleted, set both fields to NULL
  IF TG_OP = 'DELETE' THEN
    UPDATE instagram_accounts
    SET 
      client_number = NULL,
      marketing_reference = NULL
    WHERE account_id = OLD.account_id
      AND NOT EXISTS (
        SELECT 1 FROM marketing_project_instagram_accounts
        WHERE account_id = OLD.account_id
          AND marketing_project_id != OLD.marketing_project_id
      );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Update the function that syncs from instagram_accounts to instagram_posts
CREATE OR REPLACE FUNCTION sync_post_client_number_from_account()
RETURNS TRIGGER AS $$
BEGIN
  -- When a post is inserted or updated, get both fields from the account
  SELECT 
    client_number,
    marketing_reference
  INTO 
    NEW.client_number,
    NEW.marketing_reference
  FROM instagram_accounts
  WHERE account_id = NEW.account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the function that syncs from instagram_accounts to instagram_post_metrics
CREATE OR REPLACE FUNCTION sync_metric_client_number_from_account()
RETURNS TRIGGER AS $$
BEGIN
  -- When a metric is inserted or updated, get both fields from the account
  SELECT 
    client_number,
    marketing_reference
  INTO 
    NEW.client_number,
    NEW.marketing_reference
  FROM instagram_accounts
  WHERE account_id = NEW.account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to cascade updates from instagram_accounts to posts and metrics
CREATE OR REPLACE FUNCTION update_posts_metrics_on_account_client_number_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When instagram_account client_number or marketing_reference changes, update all posts
  IF NEW.client_number IS DISTINCT FROM OLD.client_number 
     OR NEW.marketing_reference IS DISTINCT FROM OLD.marketing_reference THEN
    
    UPDATE instagram_posts
    SET 
      client_number = NEW.client_number,
      marketing_reference = NEW.marketing_reference
    WHERE account_id = NEW.account_id;
    
    UPDATE instagram_post_metrics
    SET 
      client_number = NEW.client_number,
      marketing_reference = NEW.marketing_reference
    WHERE account_id = NEW.account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists on instagram_accounts for cascading updates
DROP TRIGGER IF EXISTS update_posts_metrics_client_number_trigger ON instagram_accounts;

CREATE TRIGGER update_posts_metrics_client_number_trigger
  AFTER UPDATE ON instagram_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_metrics_on_account_client_number_change();