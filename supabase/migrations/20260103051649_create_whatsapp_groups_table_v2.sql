/*
  # Create WhatsApp Groups Table

  1. New Table
    - `whatsapp_groups`
      - `id` (uuid, primary key)
      - `account_id` (uuid) - Reference to whatsapp_accounts
      - `group_id` (text) - WhatsApp Group ID (e.g., 120363XXXXXXXX@g.us)
      - `group_name` (text) - Group name
      - `participants_count` (integer) - Number of participants
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Allow all authenticated users to read and modify
*/

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create whatsapp_groups table
CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  group_id text NOT NULL,
  group_name text NOT NULL,
  participants_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id, group_id)
);

-- Enable RLS
ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_groups
CREATE POLICY "Allow all authenticated users to view whatsapp_groups"
  ON whatsapp_groups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert whatsapp_groups"
  ON whatsapp_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update whatsapp_groups"
  ON whatsapp_groups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete whatsapp_groups"
  ON whatsapp_groups
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_account_id ON whatsapp_groups(account_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_groups;

-- Set replica identity for realtime
ALTER TABLE whatsapp_groups REPLICA IDENTITY FULL;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_whatsapp_groups_updated_at ON whatsapp_groups;
CREATE TRIGGER update_whatsapp_groups_updated_at
  BEFORE UPDATE ON whatsapp_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_updated_at();
