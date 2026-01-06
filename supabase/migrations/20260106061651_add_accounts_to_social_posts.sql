/*
  # Add Account Selection to Social Media Posts

  1. Changes
    - Add instagram_account_ids (text[]) to marketing_social_posts for multi-select
    - Add facebook_account_ids (text[]) to marketing_social_posts for multi-select
    - These store the IDs of selected accounts for posting
*/

-- Add account selection columns to marketing_social_posts
ALTER TABLE marketing_social_posts
  ADD COLUMN IF NOT EXISTS instagram_account_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS facebook_account_ids text[] DEFAULT '{}';

-- Add indexes for account lookups
CREATE INDEX IF NOT EXISTS idx_marketing_social_posts_instagram_accounts ON marketing_social_posts USING GIN (instagram_account_ids);
CREATE INDEX IF NOT EXISTS idx_marketing_social_posts_facebook_accounts ON marketing_social_posts USING GIN (facebook_account_ids);
