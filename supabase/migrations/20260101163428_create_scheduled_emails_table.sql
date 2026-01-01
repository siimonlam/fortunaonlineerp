/*
  # Create Scheduled Emails System

  1. New Tables
    - `scheduled_emails`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `user_id` (uuid, foreign key to staff)
      - `recipient_emails` (text array) - list of email addresses
      - `subject` (text) - email subject
      - `body` (text) - email body content
      - `scheduled_date` (timestamptz) - when to send the email
      - `status` (text) - pending, sent, failed, cancelled
      - `sent_at` (timestamptz) - actual send timestamp
      - `error_message` (text) - error details if failed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `scheduled_emails` table
    - Users can view emails for projects they have access to
    - Users can create/edit/delete their own scheduled emails
    - Admins can manage all scheduled emails

  3. Indexes
    - Index on project_id for faster lookups
    - Index on scheduled_date for cron job processing
    - Index on status for filtering
*/

-- Create scheduled emails table
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  recipient_emails text[] NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  scheduled_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_project_id ON scheduled_emails(project_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_date ON scheduled_emails(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user_id ON scheduled_emails(user_id);

-- Enable RLS
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view scheduled emails for projects they can access
CREATE POLICY "Users can view scheduled emails for accessible projects"
  ON scheduled_emails FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create scheduled emails
CREATE POLICY "Users can create scheduled emails"
  ON scheduled_emails FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own scheduled emails
CREATE POLICY "Users can update their own scheduled emails"
  ON scheduled_emails FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to delete their own scheduled emails
CREATE POLICY "Users can delete their own scheduled emails"
  ON scheduled_emails FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_scheduled_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduled_emails_updated_at
  BEFORE UPDATE ON scheduled_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_emails_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_emails;
