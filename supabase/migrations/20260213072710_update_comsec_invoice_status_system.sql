/*
  # Update ComSec Invoice Status System

  1. Changes
    - Update invoice statuses to use: Draft, Unpaid, Paid, Overdue, Void
    - Remove 'Pending' status
    - Migrate existing invoices to new status values

  2. Status Definitions
    - **Draft**: Invoice created with Google Doc but not finalized
    - **Unpaid**: Invoice finalized and sent to client, awaiting payment
    - **Paid**: Invoice has been paid (has payment_date)
    - **Overdue**: Invoice past due date and still unpaid
    - **Void**: Invoice cancelled/voided

  3. Migration Rules
    - Invoices with status 'Draft' stay as 'Draft'
    - Invoices with status 'Pending' become 'Unpaid'
    - Invoices with status 'Paid' stay as 'Paid'
    - Other statuses become 'Unpaid'

  4. Important Notes
    - Overdue status is calculated dynamically (due_date < today AND status = 'Unpaid')
    - Status transitions: Draft -> Unpaid -> Paid/Overdue/Void
*/

-- Update existing invoices to use new status values
UPDATE comsec_invoices
SET status = CASE
  WHEN status = 'Draft' THEN 'Draft'
  WHEN status = 'Paid' THEN 'Paid'
  WHEN status = 'Pending' THEN 'Unpaid'
  ELSE 'Unpaid'
END
WHERE status NOT IN ('Draft', 'Unpaid', 'Paid', 'Overdue', 'Void');

-- Add check constraint for valid statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'comsec_invoices_status_check'
  ) THEN
    ALTER TABLE comsec_invoices
    ADD CONSTRAINT comsec_invoices_status_check
    CHECK (status IN ('Draft', 'Unpaid', 'Paid', 'Overdue', 'Void'));
  END IF;
END $$;

-- Update default status to 'Draft'
ALTER TABLE comsec_invoices
ALTER COLUMN status SET DEFAULT 'Draft';

-- Create function to auto-calculate overdue status
CREATE OR REPLACE FUNCTION check_comsec_invoice_overdue()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is Unpaid and past due date, mark as Overdue
  IF NEW.status = 'Unpaid' AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'Overdue';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check overdue status on insert/update
DROP TRIGGER IF EXISTS check_comsec_invoice_overdue_trigger ON comsec_invoices;
CREATE TRIGGER check_comsec_invoice_overdue_trigger
  BEFORE INSERT OR UPDATE ON comsec_invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_comsec_invoice_overdue();
