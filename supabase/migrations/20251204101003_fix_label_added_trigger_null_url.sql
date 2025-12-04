/*
  # Fix Label Added Trigger with Hardcoded URL

  1. Changes
    - Update trigger function to use hardcoded Supabase URL and anon key
    - Remove dependency on database settings that return NULL
    - Ensures label_added trigger properly fires automation rules

  2. Notes
    - Hardcoded URL and keys are acceptable as they're specific to this Supabase project
    - This fixes the "null value in column url" error when adding labels
    - Matches the pattern used in other automation triggers
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
  payload jsonb;
BEGIN
  -- Get the project type
  SELECT p.project_type_id INTO project_type_id_val
  FROM projects p
  WHERE p.id = NEW.project_id;

  -- Construct Edge Function URL
  function_url := supabase_url || '/functions/v1/execute-automation-rules';

  -- Build payload
  payload := jsonb_build_object(
    'trigger_type', 'label_added',
    'project_id', NEW.project_id,
    'project_type_id', project_type_id_val,
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
  RAISE LOG 'Label added automation trigger fired for project % with label %',
    NEW.project_id, NEW.label_id;

  RETURN NEW;
END;
$$;
