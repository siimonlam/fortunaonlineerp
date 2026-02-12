/*
  # Add Cost/Revenue Type to ComSec Services

  1. Changes
    - Add `cost_revenue_type` column to comsec_services table
    - Values can be: 'Revenue', 'Cost', 'Revenue (incl. cost)', or 'Prepayment'
    - Default value is 'Revenue'

  2. Purpose
    - Track whether each service is a cost or revenue item
    - Enable proper accounting categorization for invoices
    - Support mixed revenue/cost services

  3. Security
    - No RLS changes needed (uses existing policies)
*/

-- Add cost_revenue_type column to comsec_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_services' AND column_name = 'cost_revenue_type'
  ) THEN
    ALTER TABLE comsec_services 
    ADD COLUMN cost_revenue_type text DEFAULT 'Revenue';
  END IF;
END $$;

-- Add check constraint to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'comsec_services_cost_revenue_type_check'
  ) THEN
    ALTER TABLE comsec_services
    ADD CONSTRAINT comsec_services_cost_revenue_type_check 
    CHECK (cost_revenue_type IN ('Revenue', 'Cost', 'Revenue (incl. cost)', 'Prepayment'));
  END IF;
END $$;

-- Update existing services to have a default type
UPDATE comsec_services
SET cost_revenue_type = 'Revenue'
WHERE cost_revenue_type IS NULL;
