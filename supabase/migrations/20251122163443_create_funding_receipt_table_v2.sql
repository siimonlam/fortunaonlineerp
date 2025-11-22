/*
  # Create Funding Receipt Table

  1. New Tables
    - `funding_receipt`
      - `id` (uuid, primary key)
      - `receipt_number` (text, unique, not null)
      - `receipt_date` (date, not null)
      - `invoice_id` (uuid, foreign key to funding_invoice)
      - `invoice_number` (text)
      - `project_id` (uuid, foreign key to projects)
      - `project_reference` (text)
      - `payment_date` (date)
      - `payment_amount` (numeric)
      - `payment_method` (text)
      - `google_drive_url` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on `funding_receipt` table
    - Add policies for authenticated users to manage receipts
*/

-- Create funding_receipt table
CREATE TABLE IF NOT EXISTS funding_receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_id uuid REFERENCES funding_invoice(id) ON DELETE CASCADE,
  invoice_number text,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  project_reference text,
  payment_date date,
  payment_amount numeric(10, 2),
  payment_method text,
  google_drive_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE funding_receipt ENABLE ROW LEVEL SECURITY;

-- Create policies for funding_receipt (allow authenticated users to manage receipts)
CREATE POLICY "Authenticated users can view receipts"
  ON funding_receipt FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create receipts"
  ON funding_receipt FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update receipts"
  ON funding_receipt FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete receipts"
  ON funding_receipt FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_funding_receipt_invoice_id ON funding_receipt(invoice_id);
CREATE INDEX IF NOT EXISTS idx_funding_receipt_project_id ON funding_receipt(project_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE funding_receipt;
