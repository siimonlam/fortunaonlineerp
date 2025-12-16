/*
  # Create Marketing Project Instagram Accounts Junction Table

  1. New Tables
    - `marketing_project_instagram_accounts`
      - `id` (uuid, primary key)
      - `marketing_project_id` (uuid, references marketing_projects)
      - `account_id` (text, references instagram_accounts.account_id)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)
  
  2. Security
    - Enable RLS on `marketing_project_instagram_accounts` table
    - Add policies for authenticated users to manage accounts
  
  3. Indexes
    - Index on `marketing_project_id` for fast lookups
    - Index on `account_id` for reverse lookups
    - Unique constraint on (marketing_project_id, account_id) to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS marketing_project_instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid NOT NULL REFERENCES marketing_projects(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(marketing_project_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_instagram_accounts_project_id ON marketing_project_instagram_accounts(marketing_project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_instagram_accounts_account_id ON marketing_project_instagram_accounts(account_id);

ALTER TABLE marketing_project_instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view marketing project Instagram accounts"
  ON marketing_project_instagram_accounts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert marketing project Instagram accounts"
  ON marketing_project_instagram_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete marketing project Instagram accounts"
  ON marketing_project_instagram_accounts
  FOR DELETE
  TO authenticated
  USING (true);
