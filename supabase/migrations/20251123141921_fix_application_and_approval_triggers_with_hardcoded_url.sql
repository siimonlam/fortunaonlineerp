/*
  # Fix Application Number and Approval Date Triggers with Hardcoded URL

  1. Changes
    - Update trigger functions to use hardcoded Supabase URL and anon key
    - Remove dependency on database settings that aren't available
    - Matches the pattern used in the invoice payment trigger

  2. Notes
    - Hardcoded URL and keys are acceptable as they're specific to this Supabase project
    - This prevents "null value in column url" errors in http_request_queue
*/

-- Update the application_number trigger function
CREATE OR REPLACE FUNCTION trigger_automation_on_application_number_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text := 'https://yostyonvexbzlgedbfgq.supabase.co';
  function_url text;
  payload jsonb;
BEGIN
  -- Only trigger if application_number actually changed
  IF OLD.application_number IS DISTINCT FROM NEW.application_number THEN
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
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY'
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

-- Update the approval_date trigger function
CREATE OR REPLACE FUNCTION trigger_automation_on_approval_date_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text := 'https://yostyonvexbzlgedbfgq.supabase.co';
  function_url text;
  payload jsonb;
BEGIN
  -- Only trigger if approval_date actually changed
  IF OLD.approval_date IS DISTINCT FROM NEW.approval_date THEN
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
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY'
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