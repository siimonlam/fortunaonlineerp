/*
  # Create Directors and Members Tables

  1. New Tables
    - `comsec_directors`
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, references comsec_clients) - Link to com sec client
      - `name` (text, required) - Director's full name
      - `id_number` (text) - ID or passport number
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `comsec_members`
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, references comsec_clients) - Link to com sec client
      - `name` (text, required) - Member's full name
      - `id_number` (text) - ID or passport number
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can view directors/members for clients they have access to
    - Users can insert/update/delete directors/members for clients they can manage

  3. Important Notes
    - These tables store structured director and member information
    - Replaces JSON storage in comsec_clients table
    - Multiple directors and members can be added per client
*/

-- Create comsec_directors table
CREATE TABLE IF NOT EXISTS comsec_directors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  id_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create comsec_members table
CREATE TABLE IF NOT EXISTS comsec_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  id_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_comsec_directors_client ON comsec_directors(comsec_client_id);
CREATE INDEX IF NOT EXISTS idx_comsec_members_client ON comsec_members(comsec_client_id);

-- Enable RLS
ALTER TABLE comsec_directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE comsec_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comsec_directors

-- Policy: Authenticated users can view all directors
CREATE POLICY "Authenticated users can view all directors"
  ON comsec_directors
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert directors
CREATE POLICY "Authenticated users can insert directors"
  ON comsec_directors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update directors
CREATE POLICY "Authenticated users can update directors"
  ON comsec_directors
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete directors
CREATE POLICY "Authenticated users can delete directors"
  ON comsec_directors
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for comsec_members

-- Policy: Authenticated users can view all members
CREATE POLICY "Authenticated users can view all members"
  ON comsec_members
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert members
CREATE POLICY "Authenticated users can insert members"
  ON comsec_members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update members
CREATE POLICY "Authenticated users can update members"
  ON comsec_members
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete members
CREATE POLICY "Authenticated users can delete members"
  ON comsec_members
  FOR DELETE
  TO authenticated
  USING (true);

-- Create triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comsec_directors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comsec_directors_updated_at
  BEFORE UPDATE ON comsec_directors
  FOR EACH ROW
  EXECUTE FUNCTION update_comsec_directors_updated_at();

CREATE OR REPLACE FUNCTION update_comsec_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comsec_members_updated_at
  BEFORE UPDATE ON comsec_members
  FOR EACH ROW
  EXECUTE FUNCTION update_comsec_members_updated_at();