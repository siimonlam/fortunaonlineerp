/*
  # Fix Label Added Trigger to Pass Status ID

  1. Changes
    - Update trigger function to fetch and pass the project's current status_id
    - This ensures automation rules can properly match based on the project's status
    - Fixes the issue where label_added automations don't fire

  2. Notes
    - The execute-automation-rules function expects status_id for proper rule matching
    - Without status_id, the function has to do an extra lookup which may fail
    - This aligns with how other triggers (like status_changed) pass status information
*/

CREATE OR REPLACE FUNCTION trigger_label_added_automation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text := 'https://yostyonvexbzlgedbfgq.supabase.co';
  function_url text;
  project_type_id_val uuid;
  status_id_val uuid;
  payload jsonb;
BEGIN
  -- Get the project type and current status
  SELECT p.project_type_id, p.status_id 
  INTO project_type_id_val, status_id_val
  FROM projects p
  WHERE p.id = NEW.project_id;

  -- Construct Edge Function URL
  function_url := supabase_url || '/functions/v1/execute-automation-rules';

  -- Build payload
  payload := jsonb_build_object(
    'trigger_type', 'label_added',
    'project_id', NEW.project_id,
    'project_type_id', project_type_id_val,
    'status_id', status_id_val,
    'trigger_data', jsonb_build_object(
      'label_id', NEW.label_id
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
  RAISE LOG 'Label added automation trigger fired for project % with label % and status %',
    NEW.project_id, NEW.label_id, status_id_val;

  RETURN NEW;
END;
$$;
