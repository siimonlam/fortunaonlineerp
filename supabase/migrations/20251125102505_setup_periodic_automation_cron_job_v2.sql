/*
  # Setup Periodic Automation Cron Job

  1. Extensions
    - Enable pg_cron extension for scheduled jobs
    - Enable pg_net extension for HTTP requests

  2. Scheduled Job
    - Create a cron job that runs daily at 9:00 AM HKT (1:00 AM UTC)
    - Calls the execute-periodic-automations edge function
    - HKT is UTC+8, so 9:00 AM HKT = 1:00 AM UTC

  3. Security
    - Uses service role for authentication
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Remove any existing job with the same name (only if it exists)
DO $$
BEGIN
  PERFORM cron.unschedule('execute-periodic-automations-daily');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, continue
    NULL;
END $$;

-- Schedule the job to run daily at 9:00 AM HKT (1:00 AM UTC)
-- Cron format: minute hour day month dayofweek
-- '0 1 * * *' means: at minute 0 of hour 1 (1:00 AM UTC) every day
SELECT cron.schedule(
  'execute-periodic-automations-daily',
  '0 1 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/execute-periodic-automations',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);