/*
  # Create Automation Trigger for Deposit Paid Status Changes

  1. New Functions
    - `trigger_automation_on_deposit_paid_change` - Function that calls the Edge Function when deposit_paid changes to true

  2. New Triggers
    - `on_deposit_paid_change` - Trigger on projects table that fires after UPDATE of deposit_paid

  3. How it works
    - When deposit_paid is updated to true on a project
    - The trigger detects the change (OLD.deposit_paid = false AND NEW.deposit_paid = true)
    - Makes an HTTP POST request to the execute-automation-rules Edge Function
    - Edge Function executes all matching automation rules asynchronously

  4. Notes
    - Uses pg_net extension for async HTTP requests
    - Runs with SECURITY DEFINER to have necessary permissions
    - Only triggers when deposit_paid changes from false to true
*/

-- Create function to call automation Edge Function for deposit paid
CREATE OR REPLACE FUNCTION trigger_automation_on_deposit_paid_change()
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
BEGIN
  -- Only trigger if deposit_paid changed from false to true (or NULL to true)
  IF (OLD.deposit_paid IS DISTINCT FROM NEW.deposit_paid) AND NEW.deposit_paid = true THEN
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

    -- Construct Edge Function URL
    function_url := supabase_url || '/functions/v1/execute-automation-rules';

    -- Build payload
    payload := jsonb_build_object(
      'project_id', NEW.id,
      'project_type_id', NEW.project_type_id,
      'status_id', NEW.status_id,
      'trigger_type', 'deposit_paid',
      'trigger_data', jsonb_build_object(
        'deposit_amount', NEW.deposit_amount,
        'deposit_paid', NEW.deposit_paid
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
    RAISE LOG 'Automation trigger fired for project %: deposit_paid changed to true',
      NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_deposit_paid_change ON projects;

-- Create trigger on projects table
CREATE TRIGGER on_deposit_paid_change
  AFTER UPDATE OF deposit_paid ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_on_deposit_paid_change();

-- Create index on deposit_paid for better performance
CREATE INDEX IF NOT EXISTS idx_projects_deposit_paid ON projects(deposit_paid) WHERE deposit_paid = true;
