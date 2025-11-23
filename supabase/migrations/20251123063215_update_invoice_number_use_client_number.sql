/*
  # Update Invoice Number to Use Client Number

  1. Changes
    - Modifies `generate_invoice_number(client_uuid)` function
    - Now uses the client's client_number field (e.g., 0011, 0021) instead of UUID
    - Format: INV{CLIENT_NUMBER}{GLOBAL_SEQUENCE}
    - Global sequence still starts at 100 and increments for each invoice across all clients
    - Example: 
      - Client with client_number 0011's first invoice: INV0011100
      - Client with client_number 0021's first invoice: INV0021101
      - Client with client_number 0011's second invoice: INV0011102
  
  2. Notes
    - Uses a JOIN to get the client_number from the clients table
    - The global counter is shared across all clients
*/

CREATE OR REPLACE FUNCTION generate_invoice_number(client_uuid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  client_num text;
  next_sequence integer;
  invoice_num text;
BEGIN
  -- Get the client_number from the clients table
  SELECT LPAD(client_number::text, 4, '0') INTO client_num
  FROM clients
  WHERE id = client_uuid;
  
  -- If client not found or client_number is null, use a default
  IF client_num IS NULL THEN
    client_num := '0000';
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