/*
  # Setup Date-Based Automation Cron Job

  1. Function
    - Create a database function that calls the date-based automation edge function
    - Uses the Supabase URL and service role key from environment
    
  2. Cron Job
    - Schedule to run daily at 9:00 AM HKT (1:00 AM UTC)
    - HKT is UTC+8, so 9:00 AM HKT = 1:00 AM UTC
    - Runs alongside periodic automation checks
*/

-- Drop existing cron job if exists
DO $$
BEGIN
  PERFORM cron.unschedule('execute-date-based-automations-daily');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create a function to execute date-based automations
CREATE OR REPLACE FUNCTION execute_date_based_automations()
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
    url := 'https://yostyonvexbzlgedbfgq.supabase.co/functions/v1/execute-date-based-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  
  -- Log the response
  RAISE LOG 'Date-based automation executed. Status: %, Body: %', response_status, response_body;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error executing date-based automations: %', SQLERRM;
END;
$$;

-- Schedule the cron job to run daily at 9:00 AM HKT (1:00 AM UTC)
SELECT cron.schedule(
  'execute-date-based-automations-daily',
  '0 1 * * *',
  'SELECT execute_date_based_automations();'
);
