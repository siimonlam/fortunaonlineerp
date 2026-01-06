/*
  # Add Designer and Approver to Social Media Accounts

  1. Changes
    - Add designer_id to marketing_project_instagram_accounts
    - Add approver_id to marketing_project_instagram_accounts
    - Add designer_id to marketing_facebook_accounts
    - Add approver_id to marketing_facebook_accounts
  
  2. Purpose
    - Allow assignment of designer and approver per social media account
    - Designer handles Step 1 (drafting) and Step 3 (posting)
    - Approver handles Step 2 (approval)
*/

-- Add designer and approver to Instagram accounts junction table
ALTER TABLE marketing_project_instagram_accounts
ADD COLUMN IF NOT EXISTS designer_id uuid REFERENCES staff(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES staff(id) ON DELETE SET NULL;

-- Add designer and approver to Facebook accounts
ALTER TABLE marketing_facebook_accounts
ADD COLUMN IF NOT EXISTS designer_id uuid REFERENCES staff(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES staff(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_ig_accounts_designer ON marketing_project_instagram_accounts(designer_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ig_accounts_approver ON marketing_project_instagram_accounts(approver_id);
CREATE INDEX IF NOT EXISTS idx_facebook_accounts_designer ON marketing_facebook_accounts(designer_id);
CREATE INDEX IF NOT EXISTS idx_facebook_accounts_approver ON marketing_facebook_accounts(approver_id);
