/*
  # Fix HKPC Date Trigger to Include Authorization Header

  1. Changes
    - Update `trigger_automation_on_hkpc_date_change()` function to include Authorization header
    - Use hardcoded Supabase URL and anon key
    - Matches the pattern used in other automation triggers

  2. Problem Fixed
    - The trigger was calling the Edge Function without authentication
    - This caused the automations to not execute when Next HKPC Date was set
    - Now includes proper Authorization and apikey headers

  3. Security
    - Uses anon key (not service role key) for Edge Function calls
    - Maintains SECURITY DEFINER for trigger execution
*/

CREATE OR REPLACE FUNCTION trigger_automation_on_hkpc_date_change()
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
  -- Only trigger if next_hkpc_due_date actually changed
  IF OLD.next_hkpc_due_date IS DISTINCT FROM NEW.next_hkpc_due_date THEN
    
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

    -- Make async HTTP request to Edge Function with proper authentication
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
    RAISE LOG 'Automation trigger fired for project %: next_hkpc_due_date changed from % to %',
      NEW.id, OLD.next_hkpc_due_date, NEW.next_hkpc_due_date;
  END IF;

  RETURN NEW;
END;
$$;
