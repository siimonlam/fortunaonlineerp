/*
  # Fix Client Number Auto-Generation
  
  1. Changes
    - Create sequence for client numbers (if not exists)
    - Create trigger function to auto-generate client numbers in C0001 format
    - Create BEFORE INSERT trigger on clients table
    - Backfill any existing clients without client numbers
    
  2. Notes
    - Client numbers are generated as C0617, C0618, etc.
    - Uses sequence to ensure unique, sequential numbers
    - Automatically assigns on INSERT if client_number is NULL
*/

-- Create or reset the sequence for client numbers
CREATE SEQUENCE IF NOT EXISTS client_number_seq;

-- Set the sequence to start from 617 (since max is 616)
SELECT setval('client_number_seq', 617);

-- Create function to generate client number
CREATE OR REPLACE FUNCTION generate_client_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if client_number is NULL
  IF NEW.client_number IS NULL THEN
    NEW.client_number := 'C' || LPAD(nextval('client_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS set_client_number ON clients;

-- Create trigger to auto-generate client number on insert
CREATE TRIGGER set_client_number
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION generate_client_number();

-- Backfill existing clients without client numbers
DO $$
DECLARE
  client_record RECORD;
BEGIN
  FOR client_record IN 
    SELECT id FROM clients WHERE client_number IS NULL ORDER BY created_at
  LOOP
    UPDATE clients 
    SET client_number = 'C' || LPAD(nextval('client_number_seq')::text, 4, '0')
    WHERE id = client_record.id;
  END LOOP;
END $$;
