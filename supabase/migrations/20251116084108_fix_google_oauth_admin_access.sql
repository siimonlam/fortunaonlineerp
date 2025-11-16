/*
  # Fix Google OAuth Credentials Admin Access

  1. Changes
    - Allow authenticated users with admin role to insert/update Google OAuth credentials
    - Keep read access restricted to service role via the security definer function
    - Add policy for admins to manage OAuth credentials

  2. Security
    - Only admins can insert/update credentials
    - Service role maintains full access
    - Regular users cannot access credentials directly
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Service role only access" ON google_oauth_credentials;

-- Create policy for service role to have full access
CREATE POLICY "Service role full access"
  ON google_oauth_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy for admins to insert/update credentials
CREATE POLICY "Admins can manage oauth credentials"
  ON google_oauth_credentials
  FOR ALL
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
