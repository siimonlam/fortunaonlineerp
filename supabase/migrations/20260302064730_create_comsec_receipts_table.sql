/*
  # Create ComSec Receipts Table

  1. New Tables
    - `comsec_receipts`
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, FK to comsec_clients)
      - `comsec_invoice_id` (uuid, FK to comsec_invoices)
      - `receipt_number` (text) - Auto-generated receipt number
      - `receipt_date` (date) - Date of receipt
      - `amount` (numeric) - Amount received
      - `payment_method` (text) - Payment method used
      - `payment_reference` (text) - Reference number for payment
      - `remarks` (text) - Additional notes
      - `google_drive_url` (text) - URL to receipt in Google Drive
      - `pdf_url` (text) - URL to PDF version
      - `created_at` (timestamptz)
      - `created_by` (uuid, FK to staff)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `comsec_receipts` table
    - Add policies for authenticated users to read and manage receipts

  3. Indexes
    - Index on comsec_client_id
    - Index on comsec_invoice_id
    - Index on receipt_number
*/

CREATE TABLE IF NOT EXISTS comsec_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE,
  comsec_invoice_id uuid REFERENCES comsec_invoices(id) ON DELETE SET NULL,
  receipt_number text NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  payment_method text,
  payment_reference text,
  remarks text,
  google_drive_url text,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES staff(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE comsec_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view receipts"
  ON comsec_receipts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert receipts"
  ON comsec_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update receipts"
  ON comsec_receipts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete receipts"
  ON comsec_receipts
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_comsec_receipts_client_id
  ON comsec_receipts(comsec_client_id);

CREATE INDEX IF NOT EXISTS idx_comsec_receipts_invoice_id
  ON comsec_receipts(comsec_invoice_id);

CREATE INDEX IF NOT EXISTS idx_comsec_receipts_receipt_number
  ON comsec_receipts(receipt_number);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE comsec_receipts;

-- Create function to generate receipt numbers
CREATE OR REPLACE FUNCTION generate_comsec_receipt_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_number integer;
  receipt_number text;
BEGIN
  -- Get the next number from the sequence
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 'RC(\d+)') AS integer)), 0) + 1
  INTO next_number
  FROM comsec_receipts
  WHERE receipt_number ~ '^RC\d+$';
  
  -- Format as RC followed by zero-padded number
  receipt_number := 'RC' || LPAD(next_number::text, 6, '0');
  
  RETURN receipt_number;
END;
$$;
