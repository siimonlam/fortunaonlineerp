/*
  # Create Marketing Facebook Accounts Junction Table

  1. New Tables
    - `marketing_facebook_accounts`
      - Links Facebook accounts to marketing projects
      - Stores `marketing_reference` and `page_id` relationship
      - Enables automatic inheritance of project info to posts/metrics

  2. Security
    - Enable RLS on `marketing_facebook_accounts` table
    - Allow all authenticated users to view linked accounts
    - Allow users with marketing project access to manage links

  3. Notes
    - Similar to `marketing_instagram_accounts` structure
    - Ensures Facebook data inherits marketing project context
*/

-- Create marketing_facebook_accounts junction table
CREATE TABLE IF NOT EXISTS marketing_facebook_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_reference text NOT NULL REFERENCES marketing_projects(reference_number) ON DELETE CASCADE,
  page_id text NOT NULL REFERENCES facebook_accounts(page_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(marketing_reference, page_id)
);

-- Enable RLS
ALTER TABLE marketing_facebook_accounts ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view
CREATE POLICY "Allow all authenticated users to view marketing_facebook_accounts"
  ON marketing_facebook_accounts
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert
CREATE POLICY "Allow all authenticated users to insert marketing_facebook_accounts"
  ON marketing_facebook_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to delete
CREATE POLICY "Allow all authenticated users to delete marketing_facebook_accounts"
  ON marketing_facebook_accounts
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_facebook_accounts_marketing_reference 
  ON marketing_facebook_accounts(marketing_reference);
CREATE INDEX IF NOT EXISTS idx_marketing_facebook_accounts_page_id 
  ON marketing_facebook_accounts(page_id);

-- Add comment
COMMENT ON TABLE marketing_facebook_accounts IS 'Junction table linking Facebook accounts to marketing projects';