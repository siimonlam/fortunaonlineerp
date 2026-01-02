/*
  # Create Email Templates and Add Attachment Support

  1. New Tables
    - `email_templates`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references staff) - template owner
      - `template_name` (text) - name of the template
      - `subject` (text) - email subject with variables
      - `body` (text) - email body with variables
      - `is_shared` (boolean) - whether template is shared with all users
      - `created_by` (uuid, references staff)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to scheduled_emails
    - Add `send_immediately` (boolean) - send now vs schedule
    - Add `attachment_type` (text) - 'google_drive' or 'share_resource'
    - Add `attachment_ids` (jsonb) - array of file IDs/URLs to attach
    - Add `attachment_metadata` (jsonb) - metadata about attachments

  3. Security
    - Enable RLS on email_templates
    - Users can manage their own templates
    - Users can view shared templates
    - Authenticated users can update scheduled_emails for attachments

  4. Variables Supported in Templates
    - {{project_name}} - Project title
    - {{client_name}} - Client company name
    - {{client_contact}} - Client contact person
    - {{user_name}} - Current user name
    - {{today}} - Today's date
*/

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  template_name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  is_shared boolean DEFAULT false,
  created_by uuid REFERENCES staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Users can view their own templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view shared templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (is_shared = true);

CREATE POLICY "Users can create their own templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND created_by = auth.uid());

CREATE POLICY "Users can update their own templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add attachment and send immediately fields to scheduled_emails
ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS send_immediately boolean DEFAULT false;
ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS attachment_type text CHECK (attachment_type IN ('google_drive', 'share_resource', NULL));
ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS attachment_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS attachment_metadata jsonb DEFAULT '{}'::jsonb;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_shared ON email_templates(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_send_immediately ON scheduled_emails(send_immediately) WHERE send_immediately = true;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE email_templates;