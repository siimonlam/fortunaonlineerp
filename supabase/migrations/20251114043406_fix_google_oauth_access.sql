/*
  # Fix Google OAuth Credentials Access

  1. Changes
    - Drop existing RLS policy
    - Create function to fetch credentials with SECURITY DEFINER
    - This allows edge functions to access credentials securely

  2. Security
    - Function runs with definer's privileges (bypasses RLS)
    - Only returns google_drive credentials
    - No parameters to prevent injection
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Service role only access" ON google_oauth_credentials;

-- Create a security definer function to get Google Drive credentials
CREATE OR REPLACE FUNCTION get_google_drive_token()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
BEGIN
  SELECT access_token INTO token
  FROM google_oauth_credentials
  WHERE service_name = 'google_drive'
  LIMIT 1;
  
  RETURN token;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION get_google_drive_token() TO authenticated, service_role, anon;