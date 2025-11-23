/*
  # Fix Status Changed Trigger with Hardcoded URL

  1. Changes
    - Update trigger function to use hardcoded Supabase URL and anon key
    - Remove dependency on database settings that aren't available
    - Matches the pattern used in other automation triggers

  2. Notes
    - Hardcoded URL and keys are acceptable as they're specific to this Supabase project
    - This ensures the status_changed trigger properly fires automation rules
    - This allows automation rules to chain (first rule changes status, second rule reacts to that change)
*/

CREATE OR REPLACE FUNCTION trigger_automation_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text := 'https://yostyonvexbzlgedbfgq.supabase.co';
  function_url text;
  payload jsonb;
BEGIN
  -- Only trigger if status_id actually changed
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    -- Construct Edge Function URL
    function_url := supabase_url || '/functions/v1/execute-automation-rules';

    -- Build payload
    payload := jsonb_build_object(
      'project_id', NEW.id,
      'project_type_id', NEW.project_type_id,
      'status_id', NEW.status_id,
      'trigger_type', 'status_changed',
      'trigger_data', jsonb_build_object(
        'old_status_id', OLD.status_id,
        'new_status_id', NEW.status_id
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
    RAISE LOG 'Automation trigger fired for project %: status_id changed from % to %',
      NEW.id, OLD.status_id, NEW.status_id;
  END IF;

  RETURN NEW;
END;
$$;