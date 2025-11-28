/*
  # Add Deposit Paid Date to Projects

  1. Changes
    - Add deposit_paid_date column to projects table
    - Sync existing deposit invoice payment dates to the new field
    - Create trigger to auto-sync when deposit invoice payment_date is updated
  
  2. Notes
    - This field will mirror the payment_date from deposit invoices (payment_type = 'Deposit')
    - Allows quick access to deposit payment date in project view
*/

-- Add deposit_paid_date column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS deposit_paid_date date;

-- Sync existing deposit invoice payment dates to projects
UPDATE projects p
SET deposit_paid_date = fi.payment_date
FROM funding_invoice fi
WHERE fi.project_id = p.id
  AND fi.payment_type = 'Deposit'
  AND fi.payment_date IS NOT NULL;

-- Create function to sync deposit paid date when invoice is updated
CREATE OR REPLACE FUNCTION sync_deposit_paid_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update for deposit invoices
  IF NEW.payment_type = 'Deposit' THEN
    UPDATE projects
    SET deposit_paid_date = NEW.payment_date,
        updated_at = NOW()
    WHERE id = NEW.project_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-sync deposit paid date
DROP TRIGGER IF EXISTS trigger_sync_deposit_paid_date ON funding_invoice;
CREATE TRIGGER trigger_sync_deposit_paid_date
  AFTER INSERT OR UPDATE OF payment_date ON funding_invoice
  FOR EACH ROW
  EXECUTE FUNCTION sync_deposit_paid_date();
