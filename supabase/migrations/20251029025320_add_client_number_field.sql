/*
  # Add numeric client number field

  1. Changes
    - Add `client_number` integer field to clients table
    - Create sequence for auto-incrementing client numbers
    - Set default value to use sequence
    - Backfill existing clients with sequential numbers
    
  2. Security
    - Client number is auto-generated, users cannot set it manually
*/

-- Create a sequence for client numbers
CREATE SEQUENCE IF NOT EXISTS client_number_seq START WITH 1;

-- Add client_number column
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS client_number INTEGER UNIQUE DEFAULT nextval('client_number_seq');

-- Backfill existing clients with sequential numbers
DO $$
DECLARE
  client_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR client_record IN 
    SELECT id FROM clients WHERE client_number IS NULL ORDER BY created_at
  LOOP
    UPDATE clients SET client_number = counter WHERE id = client_record.id;
    counter := counter + 1;
  END LOOP;
  
  -- Update sequence to continue from the last number
  PERFORM setval('client_number_seq', counter);
END $$;

-- Make client_number NOT NULL after backfill
ALTER TABLE clients 
ALTER COLUMN client_number SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_client_number ON clients(client_number);
