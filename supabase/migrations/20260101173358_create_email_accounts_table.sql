/*
  # Create Email Accounts Management System

  1. New Tables
    - `email_accounts`
      - `id` (uuid, primary key)
      - `account_name` (text) - Descriptive name for the account
      - `smtp_host` (text) - SMTP server hostname
      - `smtp_port` (integer) - SMTP port number
      - `smtp_secure` (boolean) - Whether to use TLS/SSL
      - `smtp_user` (text) - SMTP username
      - `smtp_password` (text) - Encrypted SMTP password
      - `smtp_from_email` (text) - From email address
      - `smtp_from_name` (text) - Sender display name
      - `is_active` (boolean) - Whether account is active
      - `is_default` (boolean) - Default account for scheduling
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - References staff

  2. Changes
    - Add `from_account_id` to `scheduled_emails` table
    - Add foreign key constraint from scheduled_emails to email_accounts

  3. Security
    - Enable RLS on `email_accounts` table
    - Only authenticated users can view accounts
    - Only admins can create/update/delete accounts

  4. Notes
    - Only one account can be set as default at a time
    - Inactive accounts cannot be used for scheduling
*/

-- Create email_accounts table
CREATE TABLE IF NOT EXISTS email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_secure boolean NOT NULL DEFAULT true,
  smtp_user text NOT NULL,
  smtp_password text NOT NULL,
  smtp_from_email text NOT NULL,
  smtp_from_name text NOT NULL DEFAULT 'Your Company',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES staff(id)
);

-- Enable RLS
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_accounts
CREATE POLICY "Authenticated users can view active email accounts"
  ON email_accounts FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage email accounts"
  ON email_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Add from_account_id to scheduled_emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_emails' AND column_name = 'from_account_id'
  ) THEN
    ALTER TABLE scheduled_emails ADD COLUMN from_account_id uuid REFERENCES email_accounts(id);
  END IF;
END $$;

-- Create function to ensure only one default account
CREATE OR REPLACE FUNCTION ensure_single_default_email_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE email_accounts
    SET is_default = false
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for default account enforcement
DROP TRIGGER IF EXISTS enforce_single_default_email_account ON email_accounts;
CREATE TRIGGER enforce_single_default_email_account
  BEFORE INSERT OR UPDATE ON email_accounts
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_email_account();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_email_accounts_active ON email_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_email_accounts_default ON email_accounts(is_default);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_from_account ON scheduled_emails(from_account_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE email_accounts;