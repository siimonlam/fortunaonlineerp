/*
  # Add number_format to transform function constraint

  1. Changes
    - Update transform_function constraint to include 'number_format'
    - Allows using number formatting with commas
*/

-- Drop existing constraint
ALTER TABLE invoice_field_mappings 
DROP CONSTRAINT IF EXISTS invoice_field_mappings_transform_function_check;

-- Add new constraint with 'number_format' option
ALTER TABLE invoice_field_mappings
ADD CONSTRAINT invoice_field_mappings_transform_function_check
CHECK (transform_function IN ('uppercase', 'lowercase', 'date_format', 'currency', 'number_format'));