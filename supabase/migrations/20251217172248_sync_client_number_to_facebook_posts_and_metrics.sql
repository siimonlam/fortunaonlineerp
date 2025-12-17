/*
  # Update Facebook Sync Functions for Both Client Number and Marketing Reference

  1. Changes
    - Update sync_facebook_client_number_from_project to sync both client_number and marketing_reference
    - Create sync_post_client_number_from_account to sync both fields to posts
    - Create sync_metric_client_number_from_account to sync both fields to metrics
    - Add trigger to cascade updates when facebook_accounts fields change

  2. Purpose
    - Ensure both client_number (C0xxx) and marketing_reference (MP0xxx) are always in sync
    - Automatically propagate changes to all posts and metrics
*/

-- Update the function that syncs from marketing project to facebook_accounts
CREATE OR REPLACE FUNCTION sync_facebook_client_number_from_project()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new link is created, update the facebook_account with both client_number and marketing_reference
  IF TG_OP = 'INSERT' THEN
    UPDATE facebook_accounts
    SET 
      client_number = (
        SELECT client_number
        FROM marketing_projects
        WHERE project_reference = NEW.marketing_reference
      ),
      marketing_reference = NEW.marketing_reference
    WHERE page_id = NEW.page_id;
  END IF;

  -- When a link is deleted, set both fields to NULL
  IF TG_OP = 'DELETE' THEN
    UPDATE facebook_accounts
    SET 
      client_number = NULL,
      marketing_reference = NULL
    WHERE page_id = OLD.page_id
      AND NOT EXISTS (
        SELECT 1 FROM marketing_facebook_accounts
        WHERE page_id = OLD.page_id
          AND marketing_reference != OLD.marketing_reference
      );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create function that syncs from facebook_accounts to facebook_posts
CREATE OR REPLACE FUNCTION sync_facebook_post_client_number_from_account()
RETURNS TRIGGER AS $$
BEGIN
  -- When a post is inserted or updated, get both fields from the account
  SELECT 
    client_number,
    marketing_reference
  INTO 
    NEW.client_number,
    NEW.marketing_reference
  FROM facebook_accounts
  WHERE page_id = NEW.page_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function that syncs from facebook_accounts to facebook_post_metrics
CREATE OR REPLACE FUNCTION sync_facebook_metric_client_number_from_account()
RETURNS TRIGGER AS $$
BEGIN
  -- When a metric is inserted or updated, get both fields from the account
  SELECT 
    client_number,
    marketing_reference
  INTO 
    NEW.client_number,
    NEW.marketing_reference
  FROM facebook_accounts
  WHERE page_id = NEW.account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to cascade updates from facebook_accounts to posts and metrics
CREATE OR REPLACE FUNCTION update_facebook_posts_metrics_on_account_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When facebook_account client_number or marketing_reference changes, update all posts
  IF NEW.client_number IS DISTINCT FROM OLD.client_number 
     OR NEW.marketing_reference IS DISTINCT FROM OLD.marketing_reference THEN
    
    UPDATE facebook_posts
    SET 
      client_number = NEW.client_number,
      marketing_reference = NEW.marketing_reference
    WHERE page_id = NEW.page_id;
    
    UPDATE facebook_post_metrics
    SET 
      client_number = NEW.client_number,
      marketing_reference = NEW.marketing_reference
    WHERE account_id = NEW.page_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on facebook_posts
DROP TRIGGER IF EXISTS sync_facebook_post_client_number_trigger ON facebook_posts;
CREATE TRIGGER sync_facebook_post_client_number_trigger
  BEFORE INSERT OR UPDATE ON facebook_posts
  FOR EACH ROW
  WHEN (NEW.client_number IS NULL OR NEW.marketing_reference IS NULL)
  EXECUTE FUNCTION sync_facebook_post_client_number_from_account();

-- Create triggers on facebook_post_metrics
DROP TRIGGER IF EXISTS sync_facebook_metric_client_number_trigger ON facebook_post_metrics;
CREATE TRIGGER sync_facebook_metric_client_number_trigger
  BEFORE INSERT OR UPDATE ON facebook_post_metrics
  FOR EACH ROW
  WHEN (NEW.client_number IS NULL OR NEW.marketing_reference IS NULL)
  EXECUTE FUNCTION sync_facebook_metric_client_number_from_account();

-- Create trigger on facebook_accounts for cascading updates
DROP TRIGGER IF EXISTS update_facebook_posts_metrics_client_number_trigger ON facebook_accounts;
CREATE TRIGGER update_facebook_posts_metrics_client_number_trigger
  AFTER UPDATE ON facebook_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_facebook_posts_metrics_on_account_change();