/*
  # Add invoice_id to periodic automation executions
  
  1. Changes
    - Add `invoice_id` column to `periodic_automation_executions` table to support invoice-based automations
    - This allows tracking periodic executions per invoice (for invoice chase automations)
    
  2. Notes
    - invoice_id is nullable since not all periodic automations are invoice-based
    - When invoice_id is set, the automation tracks that specific invoice
    - When invoice_id is null, the automation tracks the project (existing behavior)
*/

-- Add invoice_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'periodic_automation_executions' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE periodic_automation_executions ADD COLUMN invoice_id uuid REFERENCES funding_invoice(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_periodic_executions_invoice_id 
  ON periodic_automation_executions(invoice_id);

-- Create composite index for automation rule + invoice lookups  
CREATE INDEX IF NOT EXISTS idx_periodic_executions_rule_invoice
  ON periodic_automation_executions(automation_rule_id, invoice_id);