/*
  # Fix Deposit Paid Trigger - Handle Null URL

  1. Changes
    - Update trigger_automation_on_deposit_paid_change function to handle null URL gracefully
    - Skip HTTP call if URL is not available
    - Log warning instead of failing
*/

CREATE OR REPLACE FUNCTION trigger_automation_on_deposit_paid_change()
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
  -- Only trigger if deposit_paid changed from false to true (or NULL to true)
  IF (OLD.deposit_paid IS DISTINCT FROM NEW.deposit_paid) AND NEW.deposit_paid = true THEN
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

    -- Only proceed if we have the required settings
    IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
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
      RAISE LOG 'Automation trigger fired for project %: deposit_paid changed to true',
        NEW.id;
    ELSE
      -- Log warning if settings not available
      RAISE WARNING 'Cannot trigger automation: Supabase URL or service role key not configured';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
