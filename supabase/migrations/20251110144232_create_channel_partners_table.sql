/*
  # Create Channel Partners Table

  1. New Tables
    - `channel_partners`
      - `id` (uuid, primary key)
      - `client_number` (integer, auto-increment, unique) - Partner reference number
      - `name` (text, required) - Partner company name
      - `contact_person` (text) - Main contact person
      - `email` (text) - Contact email
      - `phone` (text) - Contact phone
      - `address` (text) - Partner address
      - `notes` (text) - Additional notes
      - `sales_source` (text) - How the partner was acquired
      - `industry` (text) - Partner's industry
      - `abbreviation` (text) - Short name/code for the partner
      - `sales_person_id` (uuid, references staff) - Staff member responsible
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on channel_partners table
    - Users can view all channel partners (authenticated)
    - Only creators can update/delete their partners
    - Any authenticated user can create partners

  3. Important Notes
    - This table mirrors the clients table structure
    - Used to track channel partners separately from company clients
    - Auto-incrementing client_number for easy reference
*/

-- Create channel_partners table
CREATE TABLE IF NOT EXISTS channel_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_number integer GENERATED ALWAYS AS IDENTITY UNIQUE,
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  notes text,
  sales_source text,
  industry text,
  abbreviation text,
  sales_person_id uuid REFERENCES staff(id),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on client_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_channel_partners_client_number ON channel_partners(client_number);

-- Create index on sales_person_id
CREATE INDEX IF NOT EXISTS idx_channel_partners_sales_person ON channel_partners(sales_person_id);

-- Enable RLS
ALTER TABLE channel_partners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channel_partners

-- Policy: Authenticated users can view all channel partners
CREATE POLICY "Authenticated users can view all channel partners"
  ON channel_partners
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Any authenticated user can create channel partners
CREATE POLICY "Authenticated users can create channel partners"
  ON channel_partners
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can update their own channel partners
CREATE POLICY "Users can update their own channel partners"
  ON channel_partners
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own channel partners
CREATE POLICY "Users can delete their own channel partners"
  ON channel_partners
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_channel_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_channel_partners_updated_at
  BEFORE UPDATE ON channel_partners
  FOR EACH ROW
  EXECUTE FUNCTION update_channel_partners_updated_at();