/*
  # Create Funding Agreements Table

  1. New Tables
    - `funding_agreements`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `agreement_number` (text, unique)
      - `client_name` (text)
      - `project_name` (text)
      - `project_size` (numeric)
      - `funding_ratio` (text)
      - `approved_amount` (numeric)
      - `estimated_start_date` (date)
      - `estimated_end_date` (date)
      - `google_drive_url` (text)
      - `pdf_url` (text)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users to view agreements
    - Add policies for authorized users to create/delete agreements
*/

CREATE TABLE IF NOT EXISTS funding_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agreement_number text UNIQUE NOT NULL,
  client_name text NOT NULL,
  project_name text NOT NULL,
  project_size numeric,
  funding_ratio text,
  approved_amount numeric,
  estimated_start_date date,
  estimated_end_date date,
  google_drive_url text,
  pdf_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE funding_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view agreements"
  ON funding_agreements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create agreements"
  ON funding_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update agreements"
  ON funding_agreements
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete agreements"
  ON funding_agreements
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_funding_agreements_project_id ON funding_agreements(project_id);
CREATE INDEX IF NOT EXISTS idx_funding_agreements_agreement_number ON funding_agreements(agreement_number);
