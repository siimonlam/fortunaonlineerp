/*
  # Allow admins to create email accounts for users

  1. Changes
    - Update RLS policies to allow admins to create email accounts for any user
    - Allow users to view and use email accounts assigned to them (even if created by admin)
    - Update policies for scheduled emails to work with admin-created accounts

  2. Security
    - Admins can create email accounts for any user
    - Users can only view/use email accounts assigned to them (user_id = auth.uid())
    - Users cannot modify email accounts created by admins
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can insert own email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can update own email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can delete own email accounts" ON email_accounts;

-- Create new policies for email_accounts
CREATE POLICY "Users can view assigned email accounts"
  ON email_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert email accounts for any user"
  ON email_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update any email account"
  ON email_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete any email account"
  ON email_accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
