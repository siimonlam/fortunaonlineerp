/*
  # Fix ComSec Invoice Number Generator

  1. Changes
    - Updates `generate_comsec_invoice_number()` function to use MAX sequence instead of COUNT
    - This ensures invoice numbers continue from the highest existing number
    - Fixes issue where A2026002 was generated when A2026004 already exists
    
  2. Logic
    - Extracts numeric part from existing invoice numbers (e.g., "004" from "A2026004")
    - Finds the maximum sequence number
    - Increments by 1 to get the next number
*/

CREATE OR REPLACE FUNCTION generate_comsec_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  max_sequence integer;
  next_sequence integer;
  invoice_num text;
BEGIN
  -- Get the maximum sequence number from existing invoices
  -- Extract the numeric part after 'A2026' and find the highest
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'A2026(.*)') AS integer)), 0)
  INTO max_sequence
  FROM comsec_invoices
  WHERE invoice_number ~ '^A2026[0-9]+$';

  -- Increment to get next sequence
  next_sequence := max_sequence + 1;

  -- Generate invoice number: A2026 + padded sequence (e.g., A2026001, A2026002, ...)
  invoice_num := 'A2026' || LPAD(next_sequence::text, 3, '0');

  RETURN invoice_num;
END;
$$;