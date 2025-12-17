/*
  # Fix Marketing Facebook Accounts Foreign Key
  
  1. Changes
    - Drop and recreate marketing_facebook_accounts table with correct foreign key
    - Use `project_reference` instead of `reference_number`
    - Maintain same structure and policies

  2. Notes
    - Fixes foreign key constraint to point to correct column
*/

-- Drop existing table
DROP TABLE IF EXISTS marketing_facebook_accounts CASCADE;

-- Recreate table with correct foreign key
CREATE TABLE marketing_facebook_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_reference text NOT NULL REFERENCES marketing_projects(project_reference) ON DELETE CASCADE,
  page_id text NOT NULL REFERENCES facebook_accounts(page_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(marketing_reference, page_id)
);

-- Enable RLS
ALTER TABLE marketing_facebook_accounts ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Allow all authenticated users to view marketing_facebook_accounts"
  ON marketing_facebook_accounts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all authenticated users to insert marketing_facebook_accounts"
  ON marketing_facebook_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to delete marketing_facebook_accounts"
  ON marketing_facebook_accounts
  FOR DELETE
  TO authenticated
  USING (true);

-- Recreate indexes
CREATE INDEX idx_marketing_facebook_accounts_marketing_reference 
  ON marketing_facebook_accounts(marketing_reference);
CREATE INDEX idx_marketing_facebook_accounts_page_id 
  ON marketing_facebook_accounts(page_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_facebook_accounts;
ALTER TABLE marketing_facebook_accounts REPLICA IDENTITY FULL;

-- Add comment
COMMENT ON TABLE marketing_facebook_accounts IS 'Junction table linking Facebook accounts to marketing projects';