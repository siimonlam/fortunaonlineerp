/*
  # Fix ComSec Invoice Number Generator with SECURITY DEFINER

  1. Changes
    - Recreates `generate_comsec_invoice_number()` with SECURITY DEFINER
    - This allows the function to bypass RLS and read all invoices to generate correct sequence
    
  2. Purpose
    - Fixes issue where users without full invoice access (like Katrina) get incorrect invoice numbers
    - Ensures consistent sequential invoice numbering regardless of user permissions
    
  3. Security
    - Function only generates invoice numbers, doesn't expose invoice data
    - Safe to run with elevated permissions
*/

CREATE OR REPLACE FUNCTION generate_comsec_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
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
