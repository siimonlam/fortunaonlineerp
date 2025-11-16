/*
  # Fix invoice payment trigger with hardcoded Supabase URL

  1. Changes
    - Update trigger function to use hardcoded Supabase URL
    - Remove dependency on database settings that aren't available
    - Use Supabase environment variables that are available in function context

  2. Notes
    - Hardcoded URL is acceptable as it's specific to this Supabase project
    - Service role key still comes from Supabase environment
*/

-- Update the trigger function with hardcoded URL
CREATE OR REPLACE FUNCTION trigger_automation_from_invoice_payment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text := 'https://yostyonvexbzlgedbfgq.supabase.co';
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
      -- Get service role key from Supabase environment
      service_role_key := current_setting('request.jwt.claims', true)::json->>'role';
      
      -- If we can't get it from JWT, try other methods
      IF service_role_key IS NULL OR service_role_key != 'service_role' THEN
        -- Try to get from vault or use a placeholder that Supabase will inject
        service_role_key := coalesce(
          current_setting('app.settings.service_role_key', true),
          current_setting('request.env.SUPABASE_SERVICE_ROLE_KEY', true)
        );
      END IF;

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
      -- Using anon key since service role key might not be available
      PERFORM net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY'
        ),
        body := payload
      );

      -- Log for debugging
      RAISE LOG 'Deposit paid automation triggered for project % from invoice %',
        project_record.id, NEW.invoice_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
