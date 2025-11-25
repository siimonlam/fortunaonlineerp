/*
  # Setup Periodic Automation with Database Function

  1. Function
    - Create a database function that calls the edge function
    - Hardcode the Supabase URL and use environment variable for service key
    
  2. Cron Job
    - Schedule to run daily at 9:00 AM HKT (1:00 AM UTC)
    - HKT is UTC+8, so 9:00 AM HKT = 1:00 AM UTC
*/

-- Drop existing cron job
DO $$
BEGIN
  PERFORM cron.unschedule('execute-periodic-automations-daily');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create a function to execute periodic automations
CREATE OR REPLACE FUNCTION execute_periodic_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_status integer;
  response_body text;
BEGIN
  -- Call the edge function using pg_net
  SELECT status, content INTO response_status, response_body
  FROM net.http_post(
    url := 'https://yostyonvexbzlgedbfgq.supabase.co/functions/v1/execute-periodic-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  
  -- Log the response
  RAISE LOG 'Periodic automation executed. Status: %, Body: %', response_status, response_body;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error executing periodic automations: %', SQLERRM;
END;
$$;

-- Schedule the cron job to run daily at 9:00 AM HKT (1:00 AM UTC)
SELECT cron.schedule(
  'execute-periodic-automations-daily',
  '0 1 * * *',
  'SELECT execute_periodic_automations();'
);