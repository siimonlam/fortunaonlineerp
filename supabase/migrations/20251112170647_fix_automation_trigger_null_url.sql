/*
  # Fix Automation Trigger NULL URL Error

  1. Changes
    - Update `trigger_automation_on_status_change()` function to check if URL is NULL before calling net.http_post
    - Only make HTTP request if both supabase_url and service_role_key are available
    - Log warning if environment variables are not set

  2. Security
    - Maintains SECURITY DEFINER to allow access to environment variables
*/

CREATE OR REPLACE FUNCTION trigger_automation_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  function_url text;
  payload jsonb;
BEGIN
  -- Only trigger if status_id actually changed
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    -- Get Supabase URL from environment
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);

    -- If settings not available, try request.env
    IF supabase_url IS NULL THEN
      supabase_url := current_setting('request.env.SUPABASE_URL', true);
    END IF;

    IF service_role_key IS NULL THEN
      service_role_key := current_setting('request.env.SUPABASE_SERVICE_ROLE_KEY', true);
    END IF;

    -- Only proceed if we have the required environment variables
    IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
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
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := payload
      );

      -- Log for debugging
      RAISE LOG 'Automation trigger fired for project %: status_id changed from % to %',
        NEW.id, OLD.status_id, NEW.status_id;
    ELSE
      -- Log warning if environment variables not available
      RAISE WARNING 'Automation trigger skipped: Environment variables not configured (supabase_url: %, service_role_key: %)',
        supabase_url IS NOT NULL, service_role_key IS NOT NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
