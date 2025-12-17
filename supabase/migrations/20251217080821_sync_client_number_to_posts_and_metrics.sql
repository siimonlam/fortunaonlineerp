/*
  # Sync client_number from Instagram accounts to posts and metrics
  
  1. Changes
    - Create trigger to sync client_number from instagram_accounts to instagram_posts
    - Create trigger to sync client_number from instagram_accounts to instagram_post_metrics
    - Update existing posts and metrics with their account's client_number
  
  2. Purpose
    - Ensure posts and metrics always have the correct client_number for filtering
    - Maintain data consistency across Instagram tables
*/

-- Function to sync client_number from account to posts
CREATE OR REPLACE FUNCTION sync_post_client_number_from_account()
RETURNS TRIGGER AS $$
BEGIN
  -- When a post is inserted or updated, get client_number from the account
  NEW.client_number := (
    SELECT client_number
    FROM instagram_accounts
    WHERE account_id = NEW.account_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on instagram_posts
DROP TRIGGER IF EXISTS sync_post_client_number_trigger ON instagram_posts;
CREATE TRIGGER sync_post_client_number_trigger
  BEFORE INSERT OR UPDATE ON instagram_posts
  FOR EACH ROW
  EXECUTE FUNCTION sync_post_client_number_from_account();

-- Function to sync client_number from account to metrics
CREATE OR REPLACE FUNCTION sync_metric_client_number_from_account()
RETURNS TRIGGER AS $$
BEGIN
  -- When a metric is inserted or updated, get client_number from the account
  NEW.client_number := (
    SELECT client_number
    FROM instagram_accounts
    WHERE account_id = NEW.account_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on instagram_post_metrics
DROP TRIGGER IF EXISTS sync_metric_client_number_trigger ON instagram_post_metrics;
CREATE TRIGGER sync_metric_client_number_trigger
  BEFORE INSERT OR UPDATE ON instagram_post_metrics
  FOR EACH ROW
  EXECUTE FUNCTION sync_metric_client_number_from_account();

-- Function to update all posts/metrics when account client_number changes
CREATE OR REPLACE FUNCTION update_posts_metrics_on_account_client_number_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When an account's client_number changes, update all its posts and metrics
  IF NEW.client_number IS DISTINCT FROM OLD.client_number THEN
    UPDATE instagram_posts
    SET client_number = NEW.client_number
    WHERE account_id = NEW.account_id;
    
    UPDATE instagram_post_metrics
    SET client_number = NEW.client_number
    WHERE account_id = NEW.account_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on instagram_accounts for client_number changes
DROP TRIGGER IF EXISTS update_posts_metrics_client_number_trigger ON instagram_accounts;
CREATE TRIGGER update_posts_metrics_client_number_trigger
  AFTER UPDATE ON instagram_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_metrics_on_account_client_number_change();

-- Update existing posts with their account's client_number
UPDATE instagram_posts ip
SET client_number = ia.client_number
FROM instagram_accounts ia
WHERE ip.account_id = ia.account_id
AND ia.client_number IS NOT NULL;

-- Update existing metrics with their account's client_number
UPDATE instagram_post_metrics ipm
SET client_number = ia.client_number
FROM instagram_accounts ia
WHERE ipm.account_id = ia.account_id
AND ia.client_number IS NOT NULL;