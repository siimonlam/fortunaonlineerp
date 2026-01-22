/*
  # Create Inquiries Table for Website Enquiries

  1. New Tables
    - `inquiries`
      - `id` (uuid, primary key) - Unique identifier
      - `company_name` (text) - Company name
      - `name` (text) - Contact person name
      - `phone` (text) - Contact phone number
      - `email` (text) - Contact email address
      - `industry` (text) - Industry sector
      - `interest` (text) - Area of interest/inquiry details
      - `created_at` (timestamptz) - Timestamp when inquiry was submitted
      - `status` (text) - Status of inquiry (new, contacted, converted, closed)
      - `notes` (text) - Internal notes about the inquiry
      - `assigned_to` (uuid) - Staff member assigned to handle this inquiry

  2. Security
    - Enable RLS on `inquiries` table
    - Allow public (unauthenticated) to insert inquiries (for website form)
    - Allow authenticated users to view and manage inquiries
    - Allow assigned staff to update their assigned inquiries

  3. Indexes
    - Index on email for quick lookup
    - Index on status for filtering
    - Index on created_at for sorting
*/

-- Create inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  industry text,
  interest text NOT NULL,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
  notes text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inquiries_email ON inquiries(email);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_to ON inquiries(assigned_to);

-- Enable RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including unauthenticated users) to insert inquiries (for website form)
CREATE POLICY "Anyone can submit inquiries"
  ON inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow all authenticated users to view all inquiries
CREATE POLICY "Authenticated users can view all inquiries"
  ON inquiries
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update inquiries
CREATE POLICY "Authenticated users can update inquiries"
  ON inquiries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete inquiries
CREATE POLICY "Authenticated users can delete inquiries"
  ON inquiries
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER set_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_inquiries_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE inquiries;