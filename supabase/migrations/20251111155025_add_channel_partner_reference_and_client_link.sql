/*
  # Add Channel Partner Reference Number and Client Link

  1. Changes to channel_partners table
    - Add `reference_number` column with CP prefix (e.g., CP0001)
    - Generate reference numbers for existing records
    
  2. Changes to clients table
    - Add `channel_partner_id` column (nullable, foreign key to channel_partners)
    - This links clients to their channel partner source
    
  3. Purpose
    - Channel partners get unique reference numbers starting with "CP"
    - Clients can be associated with a channel partner
    - Sales source can reference channel partners

  4. Security
    - No RLS changes needed, inherits existing policies
*/

-- Add reference_number to channel_partners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_partners' AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE channel_partners ADD COLUMN reference_number text UNIQUE;
  END IF;
END $$;

-- Generate reference numbers for existing channel partners
UPDATE channel_partners
SET reference_number = 'CP' || LPAD(client_number::text, 4, '0')
WHERE reference_number IS NULL;

-- Create function to auto-generate reference number for new channel partners
CREATE OR REPLACE FUNCTION generate_channel_partner_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := 'CP' || LPAD(NEW.client_number::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generation
DROP TRIGGER IF EXISTS set_channel_partner_reference ON channel_partners;
CREATE TRIGGER set_channel_partner_reference
  BEFORE INSERT ON channel_partners
  FOR EACH ROW
  EXECUTE FUNCTION generate_channel_partner_reference();

-- Add channel_partner_id to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'channel_partner_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN channel_partner_id uuid REFERENCES channel_partners(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for channel_partner_id
CREATE INDEX IF NOT EXISTS idx_clients_channel_partner_id ON clients(channel_partner_id);

-- Add comment for documentation
COMMENT ON COLUMN channel_partners.reference_number IS 'Unique reference number with CP prefix (e.g., CP0001)';
COMMENT ON COLUMN clients.channel_partner_id IS 'Link to channel partner if client came through a partner';
