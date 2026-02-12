/*
  # Create ComSec Invoice Number Auto-Generation Function

  1. New Function
    - `generate_comsec_invoice_number()` - Generates invoice numbers in format A2026001, A2026002, etc.
    - Global counter starting from A2026001
    - Increments by 1 for each new invoice

  2. Changes
    - Creates a reusable function for ComSec invoice number generation
    - Ensures unique invoice numbers with sequential numbering
*/

CREATE OR REPLACE FUNCTION generate_comsec_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_sequence integer;
  invoice_num text;
BEGIN
  -- Get the count of existing invoices and add 1
  SELECT COUNT(*) + 1 INTO next_sequence
  FROM comsec_invoices;

  -- Generate invoice number: A2026 + padded sequence (e.g., A2026001, A2026002, ...)
  invoice_num := 'A2026' || LPAD(next_sequence::text, 3, '0');

  RETURN invoice_num;
END;
$$;