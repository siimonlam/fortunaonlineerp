/*
  # Update Invoice Number to Use Global Counter with Client Number
  
  1. Changes
    - Modifies `generate_invoice_number(client_uuid)` function
    - Uses a GLOBAL counter across all clients
    - Format: INV{CLIENT_NUMBER}{GLOBAL_SEQUENCE}
    - Global sequence starts at 100 and increments for each invoice across all clients
    - Example: 
      - Client C0007's first invoice: INVC0007100
      - Client C0021's next invoice: INVC0021101
      - Client C0007's next invoice: INVC0007102
  
  2. Notes
    - Uses the client_number field directly from clients table (e.g., C0007, C0021)
    - Counter is GLOBAL across all funding invoices
    - All clients share the same incrementing sequence
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
  SELECT client_number INTO client_num
  FROM clients
  WHERE id = client_uuid;
  
  -- If client not found or client_number is null, use a default
  IF client_num IS NULL THEN
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