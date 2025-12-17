/*
  # Clean up duplicate Instagram client_number triggers
  
  1. Changes
    - Remove old duplicate triggers for Instagram posts and metrics
    - Keep only the new comprehensive trigger system
  
  2. Purpose
    - Avoid conflicts and redundant trigger executions
    - Maintain clean trigger structure
*/

-- Drop old duplicate triggers
DROP TRIGGER IF EXISTS trigger_sync_instagram_post_client_number ON instagram_posts;
DROP TRIGGER IF EXISTS trigger_sync_instagram_metric_client_number ON instagram_post_metrics;
DROP TRIGGER IF EXISTS trigger_sync_instagram_account_client_number ON marketing_project_instagram_accounts;

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS sync_instagram_post_client_number();
DROP FUNCTION IF EXISTS sync_instagram_metric_client_number();
DROP FUNCTION IF EXISTS sync_instagram_account_client_number();