/*
  # Remove unique constraint on invoice_number

  1. Changes
    - Drop the unique constraint on `invoice_number` column in `comsec_invoices` table
    - This allows multiple service items to share the same invoice number
    
  2. Reason
    - An invoice can now have multiple line items (services)
    - Each service is stored as a separate row with the same invoice_number
    - The invoice_number groups related service items together
*/

-- Drop the unique constraint on invoice_number
ALTER TABLE comsec_invoices 
  DROP CONSTRAINT IF EXISTS comsec_invoices_invoice_number_key;

-- Add a regular index for performance (not unique)
CREATE INDEX IF NOT EXISTS idx_comsec_invoices_invoice_number 
  ON comsec_invoices(invoice_number);