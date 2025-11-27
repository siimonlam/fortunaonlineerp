/*
  # Update Invoice Number to Use Per-Client Counter
  
  1. Changes
    - Modifies `generate_invoice_number(client_uuid)` function
    - Now uses a per-client counter instead of global counter
    - Format: INV{CLIENT_NUMBER}{PER_CLIENT_SEQUENCE}
    - Each client's sequence starts at 100 and increments independently
    - Example: 
      - Client C0007's first invoice: INVC0007100
      - Client C0007's second invoice: INVC0007101
      - Client C0021's first invoice: INVC0021100
  
  2. Notes
    - Uses the client_number field directly from clients table (e.g., C0007, C0021)
    - Counter is per-client, not global
    - Each client starts their sequence at 100
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
  
  -- Get the count of invoices FOR THIS CLIENT and add 100 as base
  -- This counter is per-client, not global
  SELECT COUNT(*) + 100 INTO next_sequence
  FROM funding_invoice
  WHERE project_id IN (
    SELECT id FROM projects WHERE client_id = client_uuid
  );
  
  -- Generate invoice number: INV + CLIENT_NUMBER + PER_CLIENT_SEQUENCE
  invoice_num := 'INV' || client_num || next_sequence::text;
  
  RETURN invoice_num;
END;
$$;