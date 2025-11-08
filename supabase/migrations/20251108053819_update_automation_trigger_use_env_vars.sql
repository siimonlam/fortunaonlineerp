/*
  # Update Automation Trigger to Use Hardcoded URL

  1. Changes
    - Update trigger function to use hardcoded Supabase URL
    - Remove dependency on database settings
    - Use pg_net extension for reliable async HTTP calls
  
  2. How it works
    - When next_hkpc_due_date is updated on a project
    - The trigger makes an HTTP POST to the Edge Function
    - Edge Function has access to SUPABASE_SERVICE_ROLE_KEY via environment
    - The Edge Function executes all matching automation rules
*/

-- Update function to use hardcoded URL
CREATE OR REPLACE FUNCTION trigger_automation_on_hkpc_date_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  function_url text;
  payload jsonb;
  request_id bigint;
BEGIN
  -- Only trigger if next_hkpc_due_date actually changed
  IF OLD.next_hkpc_due_date IS DISTINCT FROM NEW.next_hkpc_due_date THEN
    
    -- Construct Edge Function URL (hardcoded for this Supabase project)
    function_url := 'https://yostyonvexbzlgedbfgq.supabase.co/functions/v1/execute-automation-rules';
    
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
    -- Note: Edge Function will use its own SUPABASE_SERVICE_ROLE_KEY from environment
    SELECT INTO request_id net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := payload
    );
    
    -- Log for debugging
    RAISE LOG 'Automation trigger fired for project % (request_id: %): next_hkpc_due_date changed from % to %',
      NEW.id, request_id, OLD.next_hkpc_due_date, NEW.next_hkpc_due_date;
  END IF;

  RETURN NEW;
END;
$$;