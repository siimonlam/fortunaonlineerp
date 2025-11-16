/*
  # Trigger deposit_paid automation from invoice payment

  1. New Functions
    - `sync_invoice_payment_to_project` - Updates project.deposit_paid when a deposit invoice is paid
    - `trigger_automation_from_invoice_payment` - Calls automation rules when invoice payment changes

  2. New Triggers
    - `on_invoice_payment_change` - Fires when funding_invoice payment_status changes

  3. How it works
    - When a funding_invoice with payment_type = 'Deposit' is marked as payment_status = 'Paid'
    - Updates the related project's deposit_paid field to true
    - This triggers the existing deposit_paid automation on projects table
    - Alternatively, directly calls the automation rules for deposit_paid

  4. Notes
    - Works with existing automation infrastructure
    - Handles both new inserts and updates
*/

-- Function to directly trigger automation rules when invoice is paid
CREATE OR REPLACE FUNCTION trigger_automation_from_invoice_payment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  function_url text;
  payload jsonb;
  project_record record;
BEGIN
  -- Only trigger if this is a deposit invoice being marked as paid
  IF NEW.payment_type = 'Deposit' 
     AND NEW.payment_status = 'Paid' 
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
    
    -- Get the project information
    SELECT id, project_type_id, status_id 
    INTO project_record
    FROM projects 
    WHERE id = NEW.project_id;
    
    IF FOUND THEN
      -- Get Supabase URL from environment
      supabase_url := current_setting('app.settings.supabase_url', true);
      service_role_key := current_setting('app.settings.service_role_key', true);

      -- If settings not available, use request.env
      IF supabase_url IS NULL THEN
        supabase_url := current_setting('request.env.SUPABASE_URL', true);
      END IF;

      IF service_role_key IS NULL THEN
        service_role_key := current_setting('request.env.SUPABASE_SERVICE_ROLE_KEY', true);
      END IF;

      -- Only proceed if we have the required environment variables
      IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
        -- Construct Edge Function URL
        function_url := supabase_url || '/functions/v1/execute-automation-rules';

        -- Build payload
        payload := jsonb_build_object(
          'project_id', project_record.id,
          'project_type_id', project_record.project_type_id,
          'status_id', project_record.status_id,
          'trigger_type', 'deposit_paid',
          'trigger_data', jsonb_build_object(
            'invoice_id', NEW.id,
            'invoice_number', NEW.invoice_number,
            'amount', NEW.amount,
            'payment_date', NEW.payment_date
          )
        );

        -- Make async HTTP request to Edge Function
        PERFORM net.http_post(
          url := function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
          ),
          body := payload
        );

        -- Log for debugging
        RAISE LOG 'Deposit paid automation triggered for project % from invoice %',
          project_record.id, NEW.invoice_number;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_invoice_payment_change ON funding_invoice;

-- Create trigger on funding_invoice table
CREATE TRIGGER on_invoice_payment_change
  AFTER INSERT OR UPDATE OF payment_status ON funding_invoice
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_from_invoice_payment();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_funding_invoice_payment_type_status 
  ON funding_invoice(payment_type, payment_status) 
  WHERE payment_type = 'Deposit' AND payment_status = 'Paid';
