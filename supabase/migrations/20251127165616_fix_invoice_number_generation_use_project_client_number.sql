/*
  # Fix Invoice Number Generation to Use Project's Client Number
  
  1. Changes
    - Updates `generate_invoice_number()` function to accept client_number directly
    - No longer looks up client_number from clients table
    - Uses the client_number passed as parameter
    - Format remains: INV{CLIENT_NUMBER}{GLOBAL_SEQUENCE}
  
  2. Notes
    - This fixes the issue where projects have client_number but not client_id
    - The function can now be called with just the client_number string
*/

CREATE OR REPLACE FUNCTION generate_invoice_number(client_num text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_sequence integer;
  invoice_num text;
BEGIN
  -- If client_number is null or empty, use a default
  IF client_num IS NULL OR client_num = '' THEN
    client_num := 'C0000';
  END IF;
  
  -- Get the GLOBAL count of all invoices and add 100 as base
  -- This counter is shared across ALL clients
  SELECT COUNT(*) + 100 INTO next_sequence
  FROM funding_invoice;
  
  -- Generate invoice number: INV + CLIENT_NUMBER + GLOBAL_SEQUENCE
  invoice_num := 'INV' || client_num || next_sequence::text;
  
  RETURN invoice_num;
END;
$$;