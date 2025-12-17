/*
  # Add last_updated to Facebook Accounts

  1. Changes
    - Add `last_updated` column to facebook_accounts table
    - Backfill with updated_at values
    - Add index for sorting

  2. Purpose
    - Match Instagram accounts table structure
    - Track when accounts were last synced
    - Enable frontend to query last_updated consistently
*/

-- Add last_updated column to facebook_accounts
ALTER TABLE facebook_accounts
ADD COLUMN IF NOT EXISTS last_updated timestamptz DEFAULT now();

-- Backfill existing records
UPDATE facebook_accounts
SET last_updated = updated_at
WHERE last_updated IS NULL;

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_facebook_accounts_last_updated 
  ON facebook_accounts(last_updated DESC);

-- Add comment
COMMENT ON COLUMN facebook_accounts.last_updated IS 'Last time the account was synced from Facebook API';