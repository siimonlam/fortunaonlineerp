/*
  # Update Invoice Number Generator to Use Global Counter

  1. Changes
    - Modifies `generate_invoice_number(client_uuid)` function
    - Now uses a GLOBAL counter across all invoices (not per-client)
    - Format: INV{CLIENT_ID}{GLOBAL_SEQUENCE}
    - Global sequence starts at 100 and increments for each invoice across all clients
    - Example: 
      - Client A's first invoice: INV[ClientA_ID]100
      - Client B's first invoice: INV[ClientB_ID]101
      - Client A's second invoice: INV[ClientA_ID]102
  
  2. Notes
    - This ensures each invoice has a unique sequential number globally
    - The counter is shared across all clients
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
  
  -- Get the GLOBAL count of all invoices and add 100 as base
  -- This counter is shared across ALL clients
  SELECT COUNT(*) + 100 INTO next_sequence
  FROM funding_invoice;
  
  -- Generate invoice number: INV + CLIENT_ID + GLOBAL_SEQUENCE
  invoice_num := 'INV' || client_id_short || next_sequence::text;
  
  RETURN invoice_num;
END;
$$;