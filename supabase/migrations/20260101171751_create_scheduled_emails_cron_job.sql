/*
  # Create Cron Job for Processing Scheduled Emails

  1. Purpose
    - Set up a cron job that runs every 5 minutes to process pending scheduled emails
    - Calls the process-scheduled-emails edge function

  2. Cron Schedule
    - Runs every 5 minutes
    - Automatically processes emails that have reached their scheduled time

  3. Security
    - Uses pg_net to call edge function with service role key
    - Only processes emails with status 'pending' and scheduled_date <= now()
*/

-- Create cron job to process scheduled emails every 5 minutes
SELECT cron.schedule(
  'process-scheduled-emails',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-scheduled-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
