/*
  # Create Automation Trigger for HKPC Date Changes

  1. New Functions
    - `trigger_automation_on_hkpc_date_change` - Function that calls the Edge Function when next_hkpc_due_date is updated
  
  2. New Triggers
    - `on_next_hkpc_due_date_change` - Trigger on projects table that fires after UPDATE of next_hkpc_due_date

  3. How it works
    - When next_hkpc_due_date is updated on a project
    - The trigger detects the change (OLD.next_hkpc_due_date IS DISTINCT FROM NEW.next_hkpc_due_date)
    - Makes an HTTP POST request to the execute-automation-rules Edge Function
    - Edge Function executes all matching automation rules asynchronously
    
  4. Notes
    - Uses pg_net extension for async HTTP requests
    - Runs with SECURITY DEFINER to have necessary permissions
    - Only triggers when next_hkpc_due_date actually changes (not on every update)
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to call automation Edge Function
CREATE OR REPLACE FUNCTION trigger_automation_on_hkpc_date_change()
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
  -- Only trigger if next_hkpc_due_date actually changed
  IF OLD.next_hkpc_due_date IS DISTINCT FROM NEW.next_hkpc_due_date THEN
    -- Get Supabase URL from environment (you can hardcode this if needed)
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
      'trigger_type', 'hkpc_date_set',
      'trigger_data', jsonb_build_object(
        'old_date', OLD.next_hkpc_due_date,
        'new_date', NEW.next_hkpc_due_date
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
    RAISE LOG 'Automation trigger fired for project %: next_hkpc_due_date changed from % to %',
      NEW.id, OLD.next_hkpc_due_date, NEW.next_hkpc_due_date;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_next_hkpc_due_date_change ON projects;

-- Create trigger on projects table
CREATE TRIGGER on_next_hkpc_due_date_change
  AFTER UPDATE OF next_hkpc_due_date ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_on_hkpc_date_change();

-- Create index on next_hkpc_due_date for better performance
CREATE INDEX IF NOT EXISTS idx_projects_next_hkpc_due_date ON projects(next_hkpc_due_date) WHERE next_hkpc_due_date IS NOT NULL;