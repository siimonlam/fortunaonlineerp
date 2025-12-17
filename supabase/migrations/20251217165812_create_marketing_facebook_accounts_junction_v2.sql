/*
  # Create Marketing Facebook Accounts Junction Table

  1. New Table
    - `marketing_facebook_accounts`
      - `id` (uuid, primary key)
      - `marketing_reference` (text, foreign key to marketing_projects.project_reference)
      - `page_id` (text, reference to Facebook page)
      - `client_number` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Allow all authenticated users to manage

  3. Realtime
    - Enable realtime replication
*/

-- Create marketing_facebook_accounts junction table
CREATE TABLE IF NOT EXISTS marketing_facebook_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_reference text NOT NULL,
  page_id text NOT NULL,
  client_number text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(marketing_reference, page_id)
);

-- Create foreign key constraint
ALTER TABLE marketing_facebook_accounts
  ADD CONSTRAINT fk_marketing_facebook_marketing_reference
  FOREIGN KEY (marketing_reference)
  REFERENCES marketing_projects(project_reference)
  ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketing_facebook_marketing_reference 
  ON marketing_facebook_accounts(marketing_reference);
CREATE INDEX IF NOT EXISTS idx_marketing_facebook_page_id 
  ON marketing_facebook_accounts(page_id);

-- Enable RLS
ALTER TABLE marketing_facebook_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All authenticated users can view marketing facebook accounts"
  ON marketing_facebook_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert marketing facebook accounts"
  ON marketing_facebook_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update marketing facebook accounts"
  ON marketing_facebook_accounts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can delete marketing facebook accounts"
  ON marketing_facebook_accounts FOR DELETE
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_facebook_accounts;