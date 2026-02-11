/*
  # Create Designated Representatives Table

  1. New Table
    - `comsec_designated_representatives`
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, references comsec_clients) - Link to com sec client
      - `designated_type` (text, 'individual' or 'corporation')

      Individual fields:
      - `name_chinese` (text) - Chinese name
      - `name_english` (text) - English name
      - `correspondence_address` (text) - Correspondence address
      - `hkid` (text) - Hong Kong ID

      Corporation fields:
      - `company_name_chinese` (text) - Company name in Chinese
      - `company_name_english` (text) - Company name in English
      - `registered_office_address` (text) - Registered office address
      - `brn` (text) - Business Registration Number

      Common fields:
      - `capacity` (text) - Capacity/role
      - `tel_fax_no` (text) - Telephone/Fax number
      - `becoming_date` (date) - Date of becoming designated representative
      - `cessation_date` (date) - Date of cessation

      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on the table
    - Authenticated users can view all designated representatives
    - Authenticated users can insert/update/delete designated representatives

  3. Important Notes
    - Supports both individual and corporation designated representatives
    - Tracks appointment and cessation dates
    - Records capacity and contact information
*/

-- Create comsec_designated_representatives table
CREATE TABLE IF NOT EXISTS comsec_designated_representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE NOT NULL,
  designated_type text DEFAULT 'individual' CHECK (designated_type IN ('individual', 'corporation')),

  -- Individual fields
  name_chinese text,
  name_english text,
  correspondence_address text,
  hkid text,

  -- Corporation fields
  company_name_chinese text,
  company_name_english text,
  registered_office_address text,
  brn text,

  -- Common fields
  capacity text,
  tel_fax_no text,
  becoming_date date,
  cessation_date date,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_comsec_designated_representatives_client ON comsec_designated_representatives(comsec_client_id);

-- Enable RLS
ALTER TABLE comsec_designated_representatives ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comsec_designated_representatives

-- Policy: Authenticated users can view all designated representatives
CREATE POLICY "Authenticated users can view all designated representatives"
  ON comsec_designated_representatives
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert designated representatives
CREATE POLICY "Authenticated users can insert designated representatives"
  ON comsec_designated_representatives
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update designated representatives
CREATE POLICY "Authenticated users can update designated representatives"
  ON comsec_designated_representatives
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete designated representatives
CREATE POLICY "Authenticated users can delete designated representatives"
  ON comsec_designated_representatives
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comsec_designated_representatives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comsec_designated_representatives_updated_at
  BEFORE UPDATE ON comsec_designated_representatives
  FOR EACH ROW
  EXECUTE FUNCTION update_comsec_designated_representatives_updated_at();