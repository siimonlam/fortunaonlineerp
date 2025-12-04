/*
  # Fix Invoice Visibility and Auto-sync Deposit Paid Status

  ## Changes
  
  1. **Invoice Visibility (Issue #1)**
     - Drop restrictive SELECT policy on funding_invoice
     - Create new policy allowing all authenticated users to view all invoices
     - Keep UPDATE/DELETE policies restricted for security
  
  2. **Auto-sync Deposit Paid (Issue #2)**
     - Create trigger function to automatically set projects.deposit_paid = true
     - Trigger when deposit invoice payment_status changes to 'Paid'
     - Works regardless of user permissions (SECURITY DEFINER)
  
  ## Security Notes
  - Invoices are now visible to all authenticated users
  - Only users with project access can update/delete invoices
  - Deposit status sync happens automatically server-side
*/

-- Drop the restrictive SELECT policy on funding_invoice
DROP POLICY IF EXISTS "Users can view invoices for projects they have access" ON funding_invoice;

-- Create new policy allowing all authenticated users to view all invoices
CREATE POLICY "All authenticated users can view all invoices"
  ON funding_invoice
  FOR SELECT
  TO authenticated
  USING (true);

-- Create function to automatically sync deposit_paid status
CREATE OR REPLACE FUNCTION sync_project_deposit_paid_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process deposit invoices being marked as paid
  IF NEW.payment_type = 'Deposit' 
     AND NEW.payment_status = 'Paid' 
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) 
  THEN
    -- Update the project's deposit_paid status
    UPDATE projects
    SET 
      deposit_paid = true,
      updated_at = now()
    WHERE id = NEW.project_id;
    
    RAISE LOG 'Auto-synced deposit_paid = true for project %', NEW.project_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_deposit_invoice_paid ON funding_invoice;

-- Create trigger to sync deposit_paid status
CREATE TRIGGER on_deposit_invoice_paid
  AFTER INSERT OR UPDATE OF payment_status
  ON funding_invoice
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_deposit_paid_status();
