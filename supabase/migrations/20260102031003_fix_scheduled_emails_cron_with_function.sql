/*
  # Fix Scheduled Emails Cron Job

  1. Purpose
    - Fix the scheduled emails cron job to use a database function
    - Use hardcoded Supabase URL like other cron jobs

  2. Changes
    - Drop the old cron job that used app.settings
    - Create a database function to call the edge function
    - Create new cron job that runs every 2 minutes

  3. Security
    - Function uses SECURITY DEFINER for proper permissions
    - Calls the process-scheduled-emails edge function
*/

-- Drop existing cron job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-emails');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create a function to process scheduled emails
CREATE OR REPLACE FUNCTION process_scheduled_emails_cron()
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
    url := 'https://yostyonvexbzlgedbfgq.supabase.co/functions/v1/process-scheduled-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  
  -- Log the response
  RAISE LOG 'Scheduled emails processed. Status: %, Body: %', response_status, response_body;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error processing scheduled emails: %', SQLERRM;
END;
$$;

-- Schedule the cron job to run every 2 minutes
SELECT cron.schedule(
  'process-scheduled-emails',
  '*/2 * * * *',
  'SELECT process_scheduled_emails_cron();'
);
