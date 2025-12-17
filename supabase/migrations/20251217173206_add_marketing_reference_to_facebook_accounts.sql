/*
  # Add marketing_reference to Facebook Accounts

  1. Changes
    - Add `marketing_reference` column to facebook_accounts table
    - Add index for filtering
    - Backfill with data from junction table

  2. Purpose
    - Enable facebook_accounts to track which marketing project they belong to
    - Match the structure used by facebook_posts and facebook_post_metrics
    - Support the existing trigger functions that sync this field
*/

-- Add marketing_reference column to facebook_accounts
ALTER TABLE facebook_accounts
ADD COLUMN IF NOT EXISTS marketing_reference text;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_facebook_accounts_marketing_reference 
  ON facebook_accounts(marketing_reference);

-- Backfill existing records with marketing_reference from junction table
UPDATE facebook_accounts fa
SET marketing_reference = mfa.marketing_reference
FROM marketing_facebook_accounts mfa
WHERE fa.page_id = mfa.page_id;

-- Add comment
COMMENT ON COLUMN facebook_accounts.marketing_reference IS 'Reference to marketing project (MP0xxx format)';