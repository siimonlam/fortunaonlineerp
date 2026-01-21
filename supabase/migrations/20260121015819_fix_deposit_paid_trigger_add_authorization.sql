/*
  # Fix Deposit Paid Trigger to Include Authorization Header

  1. Changes
    - Update `trigger_automation_on_deposit_paid_change()` to include Authorization header
    - Use hardcoded Supabase URL and anon key like other triggers
    - Remove dependency on environment variables that return NULL

  2. Problem Fixed
    - The trigger was trying to get credentials from environment variables
    - These variables are not available in the database trigger context
    - Now uses the same pattern as other working triggers

  3. Security
    - Uses anon key for Edge Function calls
    - Maintains SECURITY DEFINER for trigger execution
*/

CREATE OR REPLACE FUNCTION trigger_automation_on_deposit_paid_change()
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
  -- Only trigger if deposit_paid changed from false to true (or NULL to true)
  IF (OLD.deposit_paid IS DISTINCT FROM NEW.deposit_paid) AND NEW.deposit_paid = true THEN
    
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
    RAISE LOG 'Automation trigger fired for project %: deposit_paid changed to true',
      NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
