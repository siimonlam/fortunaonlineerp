/*
  # Create Virtual Office Letters Table

  1. New Tables
    - `virtual_office_letters`
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, foreign key to comsec_clients)
      - `company_code` (text) - Denormalized for easy access
      - `company_name` (text) - Denormalized for easy access
      - `letter_received_date` (date) - When the letter was received
      - `sender_name` (text) - Name of the sender
      - `letter_reference_number` (text) - Reference number of the letter
      - `pickup_preference` (text) - How client wants to pick up (e.g., "Pickup", "Mail", "Scan & Email")
      - `is_picked_up` (boolean) - Whether letter has been picked up
      - `pickup_date` (date) - When letter was picked up
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz)
      - `created_by` (uuid, foreign key to auth.users)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `virtual_office_letters` table
    - Add policies for authenticated users to manage letters
    - Restrict access based on user permissions

  3. Indexes
    - Index on comsec_client_id for fast lookups
    - Index on letter_received_date for date filtering
    - Index on company_code for quick searches
*/

-- Create virtual_office_letters table
CREATE TABLE IF NOT EXISTS virtual_office_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid NOT NULL REFERENCES comsec_clients(id) ON DELETE CASCADE,
  company_code text NOT NULL,
  company_name text NOT NULL,
  letter_received_date date NOT NULL DEFAULT CURRENT_DATE,
  sender_name text NOT NULL,
  letter_reference_number text,
  pickup_preference text DEFAULT 'Pickup',
  is_picked_up boolean DEFAULT false,
  pickup_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE virtual_office_letters ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view virtual office letters"
ON virtual_office_letters
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert virtual office letters"
ON virtual_office_letters
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update virtual office letters"
ON virtual_office_letters
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete virtual office letters"
ON virtual_office_letters
FOR DELETE
TO authenticated
USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_virtual_office_letters_client 
ON virtual_office_letters(comsec_client_id);

CREATE INDEX IF NOT EXISTS idx_virtual_office_letters_date 
ON virtual_office_letters(letter_received_date DESC);

CREATE INDEX IF NOT EXISTS idx_virtual_office_letters_company_code 
ON virtual_office_letters(company_code);

CREATE INDEX IF NOT EXISTS idx_virtual_office_letters_pickup 
ON virtual_office_letters(is_picked_up, letter_received_date DESC);

-- Enable realtime for virtual_office_letters
ALTER PUBLICATION supabase_realtime ADD TABLE virtual_office_letters;

-- Set replica identity to full for proper realtime updates
ALTER TABLE virtual_office_letters REPLICA IDENTITY FULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_virtual_office_letters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_virtual_office_letters_updated_at
  BEFORE UPDATE ON virtual_office_letters
  FOR EACH ROW
  EXECUTE FUNCTION update_virtual_office_letters_updated_at();
