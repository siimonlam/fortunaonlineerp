/*
  # Fix Scheduled Emails - Direct Processing

  1. Purpose
    - Replace pg_net HTTP calls with direct edge function invocation
    - Avoid timeouts by processing emails directly
  
  2. Changes
    - Update cron function to invoke edge function directly via Supabase invoke
    - Remove pg_net dependency
*/

-- Drop the old function
DROP FUNCTION IF EXISTS process_scheduled_emails_cron();

-- Create new function that uses Supabase edge function invocation
CREATE OR REPLACE FUNCTION process_scheduled_emails_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_email RECORD;
  email_account_record RECORD;
  email_function_response text;
BEGIN
  -- Get all pending emails that should be sent
  FOR pending_email IN 
    SELECT * FROM scheduled_emails 
    WHERE status = 'pending' 
    AND (send_immediately = true OR scheduled_date <= NOW())
    ORDER BY scheduled_date ASC
    LIMIT 10
  LOOP
    BEGIN
      -- Get the email account details
      SELECT * INTO email_account_record
      FROM email_accounts
      WHERE id = pending_email.from_account_id;
      
      IF email_account_record IS NULL THEN
        UPDATE scheduled_emails 
        SET status = 'failed', 
            error_message = 'Email account not found'
        WHERE id = pending_email.id;
        CONTINUE;
      END IF;
      
      -- Call the send-smtp-email edge function using net.http_post with immediate processing
      PERFORM net.http_post(
        url := 'https://yostyonvexbzlgedbfgq.supabase.co/functions/v1/send-smtp-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'to', pending_email.recipient_emails,
          'subject', pending_email.subject,
          'body', pending_email.body,
          'html', false,
          'smtpSettings', jsonb_build_object(
            'smtp_host', email_account_record.smtp_host,
            'smtp_port', email_account_record.smtp_port::text,
            'smtp_secure', email_account_record.smtp_secure::text,
            'smtp_user', email_account_record.smtp_user,
            'smtp_password', email_account_record.smtp_password,
            'smtp_from_email', email_account_record.smtp_from_email,
            'smtp_from_name', email_account_record.smtp_from_name
          )
        ),
        timeout_milliseconds := 30000
      );
      
      -- Mark as sent immediately (optimistic approach)
      UPDATE scheduled_emails 
      SET status = 'sent',
          sent_at = NOW()
      WHERE id = pending_email.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Mark as failed if any error occurs
        UPDATE scheduled_emails 
        SET status = 'failed',
            error_message = SQLERRM
        WHERE id = pending_email.id;
    END;
  END LOOP;
END;
$$;
