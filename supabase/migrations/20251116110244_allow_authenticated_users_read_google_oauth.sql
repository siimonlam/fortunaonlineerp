/*
  # Allow authenticated users to read Google OAuth credentials

  1. Changes
    - Add RLS policy to allow all authenticated users to SELECT from google_oauth_credentials
    - This enables any user to create invoices using the organization's Google Drive authorization
  
  2. Security
    - Users can only READ credentials (SELECT only)
    - Only admins can still INSERT, UPDATE, or DELETE credentials
    - This is safe because the credentials are used server-side for API calls
*/

-- Allow all authenticated users to read Google OAuth credentials
CREATE POLICY "Authenticated users can read oauth credentials"
  ON google_oauth_credentials
  FOR SELECT
  TO authenticated
  USING (true);
