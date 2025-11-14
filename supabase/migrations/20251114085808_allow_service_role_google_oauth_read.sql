/*
  # Allow Service Role to Read Google OAuth Credentials

  1. Changes
    - Add RLS policy to allow service_role to read google_oauth_credentials
    - Add RLS policy to allow service_role to update google_oauth_credentials

  2. Security
    - Only service_role can access credentials
    - Required for edge functions to refresh tokens
*/

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Service role can read credentials" ON google_oauth_credentials;
DROP POLICY IF EXISTS "Service role can update credentials" ON google_oauth_credentials;

-- Allow service role to read credentials
CREATE POLICY "Service role can read credentials"
  ON google_oauth_credentials
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service role to update credentials (for token refresh)
CREATE POLICY "Service role can update credentials"
  ON google_oauth_credentials
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);