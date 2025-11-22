/*
  # Create Invoice Number Auto-Generation Function

  1. New Function
    - `generate_invoice_number(client_uuid)` - Generates invoice numbers in format INV{CLIENT_ID}{SEQUENCE}
    - Sequence starts at 100 for first invoice per client
    - Increments by 1 for each subsequent invoice
    - Uses client's UUID (first 8 characters) as the CLIENT_ID portion
  
  2. Changes
    - Creates a reusable function for invoice number generation
    - Ensures unique invoice numbers per client with sequential numbering
*/

CREATE OR REPLACE FUNCTION generate_invoice_number(client_uuid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  client_id_short text;
  next_sequence integer;
  invoice_num text;
BEGIN
  -- Get first 8 characters of client UUID for readability
  client_id_short := UPPER(REPLACE(SUBSTRING(client_uuid::text, 1, 8), '-', ''));
  
  -- Get the count of existing invoices for this client and add 100 as base
  SELECT COUNT(*) + 100 INTO next_sequence
  FROM funding_invoice
  WHERE client_id = client_uuid;
  
  -- Generate invoice number: INV + CLIENT_ID + SEQUENCE
  invoice_num := 'INV' || client_id_short || next_sequence::text;
  
  RETURN invoice_num;
END;
$$;
