/*
  # Add Issued Company and Category to Funding Invoices

  1. Changes
    - Add `issued_company` column with default value "Amazing Channel (HK) Limited"
    - Add `category` column for invoice categorization
    - Default existing invoices to have issued_company set
  
  2. Categories
    - Marketing
    - Website
    - Production
    - BUD
    - TVP
    - Platform
    - Others
*/

-- Add issued_company column with default value
ALTER TABLE funding_invoice 
ADD COLUMN IF NOT EXISTS issued_company text DEFAULT 'Amazing Channel (HK) Limited';

-- Add category column
ALTER TABLE funding_invoice 
ADD COLUMN IF NOT EXISTS category text;

-- Update all existing invoices to have the default issued_company if null
UPDATE funding_invoice 
SET issued_company = 'Amazing Channel (HK) Limited' 
WHERE issued_company IS NULL;
