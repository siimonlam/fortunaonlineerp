/*
  # Create Automation Triggers for Application Number and Approval Date

  1. New Functions
    - `trigger_automation_on_application_number_change` - Triggers when application_number is set
    - `trigger_automation_on_approval_date_change` - Triggers when approval_date is set
  
  2. New Triggers
    - `on_application_number_set` - Fires when application_number field is updated
    - `on_approval_date_set` - Fires when approval_date field is updated

  3. How it works
    - When application_number or approval_date is updated on a project
    - The trigger detects the change
    - Makes an HTTP POST request to the execute-automation-rules Edge Function
    - Edge Function executes all matching automation rules asynchronously
    
  4. Notes
    - Uses pg_net extension for async HTTP requests
    - Runs with SECURITY DEFINER to have necessary permissions
    - Only triggers when the field actually changes (not on every update)
*/

-- Create function to call automation on application_number change
CREATE OR REPLACE FUNCTION trigger_automation_on_application_number_change()
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
  -- Only trigger if application_number actually changed
  IF OLD.application_number IS DISTINCT FROM NEW.application_number THEN
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
      'trigger_type', 'application_number_set',
      'trigger_data', jsonb_build_object(
        'old_value', OLD.application_number,
        'new_value', NEW.application_number
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
    RAISE LOG 'Automation trigger fired for project %: application_number changed from % to %',
      NEW.id, OLD.application_number, NEW.application_number;
  END IF;

  RETURN NEW;
END;
$$;

-- Create function to call automation on approval_date change
CREATE OR REPLACE FUNCTION trigger_automation_on_approval_date_change()
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
  -- Only trigger if approval_date actually changed
  IF OLD.approval_date IS DISTINCT FROM NEW.approval_date THEN
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
      'trigger_type', 'approval_date_set',
      'trigger_data', jsonb_build_object(
        'old_date', OLD.approval_date,
        'new_date', NEW.approval_date
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
    RAISE LOG 'Automation trigger fired for project %: approval_date changed from % to %',
      NEW.id, OLD.approval_date, NEW.approval_date;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_application_number_set ON projects;
DROP TRIGGER IF EXISTS on_approval_date_set ON projects;

-- Create trigger on projects table for application_number
CREATE TRIGGER on_application_number_set
  AFTER UPDATE OF application_number ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_on_application_number_change();

-- Create trigger on projects table for approval_date
CREATE TRIGGER on_approval_date_set
  AFTER UPDATE OF approval_date ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_on_approval_date_change();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_application_number ON projects(application_number) WHERE application_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_approval_date ON projects(approval_date) WHERE approval_date IS NOT NULL;