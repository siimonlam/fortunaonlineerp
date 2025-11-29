/*
  # Fix Client Number Preview and Auto-Set Parent Client ID

  1. Changes
    - Create function to peek at next client number without consuming it
    - Update trigger to auto-set parent_client_id to the new client_number on INSERT

  2. Notes
    - get_next_client_number returns the next number that will be assigned
    - Parent client ID is automatically set to the new client's own client_number
*/

-- Create function to get next client number without consuming the sequence
CREATE OR REPLACE FUNCTION get_next_client_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Get current value + 1 without consuming
  SELECT last_value + 1 INTO next_num FROM client_number_seq;
  RETURN 'C' || LPAD(next_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger function to also set parent_client_id to the new client_number
CREATE OR REPLACE FUNCTION generate_client_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if client_number is NULL
  IF NEW.client_number IS NULL THEN
    NEW.client_number := 'C' || LPAD(nextval('client_number_seq')::text, 4, '0');
  END IF;
  
  -- Auto-set parent_client_id to the new client_number if not provided
  IF TG_TABLE_NAME = 'clients' AND NEW.parent_client_id IS NULL THEN
    NEW.parent_client_id := NEW.client_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
