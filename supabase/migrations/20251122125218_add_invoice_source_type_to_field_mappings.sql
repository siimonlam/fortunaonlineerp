/*
  # Add Invoice Source Type to Field Mappings

  1. Changes
    - Update check constraint on `invoice_field_mappings` table
    - Add 'invoice' as valid source_type option
    - Allows mapping invoice-specific fields like invoice number, amount, payment type
*/

-- Drop existing constraint
ALTER TABLE invoice_field_mappings 
DROP CONSTRAINT IF EXISTS invoice_field_mappings_source_type_check;

-- Add new constraint with 'invoice' option
ALTER TABLE invoice_field_mappings
ADD CONSTRAINT invoice_field_mappings_source_type_check 
CHECK (source_type = ANY (ARRAY['project'::text, 'client'::text, 'invoice'::text]));
