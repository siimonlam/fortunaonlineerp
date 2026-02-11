/*
  # Create Company Secretaries Table

  1. New Table
    - `comsec_company_secretaries`
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, references comsec_clients) - Link to com sec client
      - `secretary_type` (text, 'individual' or 'corporation')

      Individual fields:
      - `name_chinese` (text) - Chinese name
      - `name_english` (text) - English name
      - `correspondence_address` (text) - Correspondence address
      - `hkid` (text) - Hong Kong ID

      Corporation fields:
      - `company_name_chinese` (text) - Company name in Chinese
      - `company_name_english` (text) - Company name in English
      - `registered_office_address` (text) - Registered office address
      - `company_number` (text) - Company number

      Common fields:
      - `tcsp_no` (text) - Trust or Company Service Provider License Number
      - `date_of_appointment` (date) - Date of appointment
      - `date_of_resignation` (date) - Date of resignation
      - `is_first_secretary` (boolean) - Whether this is the first company secretary

      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on the table
    - Authenticated users can view all company secretaries
    - Authenticated users can insert/update/delete company secretaries

  3. Important Notes
    - Supports both individual and corporation company secretaries
    - TCSP No. is the Trust or Company Service Provider License Number
    - First company secretary flag helps identify the primary secretary
*/

-- Create comsec_company_secretaries table
CREATE TABLE IF NOT EXISTS comsec_company_secretaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE NOT NULL,
  secretary_type text DEFAULT 'individual' CHECK (secretary_type IN ('individual', 'corporation')),

  -- Individual secretary fields
  name_chinese text,
  name_english text,
  correspondence_address text,
  hkid text,

  -- Corporation secretary fields
  company_name_chinese text,
  company_name_english text,
  registered_office_address text,
  company_number text,

  -- Common fields
  tcsp_no text,
  date_of_appointment date,
  date_of_resignation date,
  is_first_secretary boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_comsec_company_secretaries_client ON comsec_company_secretaries(comsec_client_id);

-- Enable RLS
ALTER TABLE comsec_company_secretaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comsec_company_secretaries

-- Policy: Authenticated users can view all company secretaries
CREATE POLICY "Authenticated users can view all company secretaries"
  ON comsec_company_secretaries
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert company secretaries
CREATE POLICY "Authenticated users can insert company secretaries"
  ON comsec_company_secretaries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update company secretaries
CREATE POLICY "Authenticated users can update company secretaries"
  ON comsec_company_secretaries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete company secretaries
CREATE POLICY "Authenticated users can delete company secretaries"
  ON comsec_company_secretaries
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comsec_company_secretaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comsec_company_secretaries_updated_at
  BEFORE UPDATE ON comsec_company_secretaries
  FOR EACH ROW
  EXECUTE FUNCTION update_comsec_company_secretaries_updated_at();