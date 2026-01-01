/*
  # Add User Ownership to Email Accounts

  1. Changes
    - Add `user_id` column to `email_accounts` to track account ownership
    - Each email account belongs to a specific user
    - Users can only use their own email accounts when scheduling
    - Remove `is_default` field since each user has their own accounts
    - Update indexes for performance

  2. Security
    - Update RLS policies so users can only view/manage their own accounts
    - Users can only see and use their own accounts

  3. Migration Steps
    - Add user_id column (nullable first)
    - Set created_by as user_id for existing accounts
    - Make user_id NOT NULL
    - Update RLS policies
    - Remove is_default functionality
*/

-- Drop the trigger and function first
DROP TRIGGER IF EXISTS enforce_single_default_email_account ON email_accounts;
DROP FUNCTION IF EXISTS ensure_single_default_email_account();

-- Add user_id column as nullable first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_accounts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE email_accounts ADD COLUMN user_id uuid REFERENCES staff(id);
  END IF;
END $$;

-- Set user_id to created_by for existing accounts, or first admin user if created_by is null
UPDATE email_accounts
SET user_id = COALESCE(
  created_by,
  (SELECT id FROM staff WHERE is_admin = true LIMIT 1)
)
WHERE user_id IS NULL;

-- Make user_id NOT NULL now that all rows have values
ALTER TABLE email_accounts ALTER COLUMN user_id SET NOT NULL;

-- Set default for new inserts
ALTER TABLE email_accounts ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Remove the is_default field
ALTER TABLE email_accounts DROP COLUMN IF EXISTS is_default;

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can view active email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Admins can manage email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can view their own active email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can create their own email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can update their own email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can delete their own email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Admins can view all email accounts" ON email_accounts;

-- Create new RLS policies for user-owned accounts
CREATE POLICY "Users can view their own active email accounts"
  ON email_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

CREATE POLICY "Users can create their own email accounts"
  ON email_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own email accounts"
  ON email_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own email accounts"
  ON email_accounts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all email accounts (for monitoring purposes)
CREATE POLICY "Admins can view all email accounts"
  ON email_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Update indexes
DROP INDEX IF EXISTS idx_email_accounts_default;
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_active ON email_accounts(user_id, is_active);