/*
  # Create Google Drive OAuth Storage

  1. New Table
    - `google_oauth_credentials`
      - `id` (uuid, primary key)
      - `service_name` (text) - e.g., 'google_drive'
      - `access_token` (text) - OAuth access token
      - `refresh_token` (text) - OAuth refresh token for renewal
      - `token_expires_at` (timestamptz) - When the access token expires
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `google_oauth_credentials` table
    - Only service role can access (edge functions only)
*/

CREATE TABLE IF NOT EXISTS google_oauth_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE google_oauth_credentials ENABLE ROW LEVEL SECURITY;

-- No user policies - only service role can access via edge functions
CREATE POLICY "Service role only access"
  ON google_oauth_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);