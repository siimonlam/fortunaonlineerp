/*
  # Create Scan Sessions Table

  1. New Tables
    - `scan_sessions`
      - `id` (uuid, primary key)
      - `session_id` (text, unique) - unique identifier for the scan session
      - `image_data` (text) - base64 encoded image data
      - `status` (text) - 'waiting', 'scanned', 'completed'
      - `created_at` (timestamp)
      - `expires_at` (timestamp)

  2. Security
    - Enable RLS on `scan_sessions` table
    - Allow all authenticated users to create and read sessions
    - Auto-delete expired sessions after 10 minutes

  3. Notes
    - Sessions expire after 10 minutes for security
    - Used for temporary phone-to-desktop scanning
*/

CREATE TABLE IF NOT EXISTS scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  image_data text,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'scanned', 'completed')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create scan sessions"
  ON scan_sessions
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view scan sessions"
  ON scan_sessions
  FOR SELECT
  TO public
  USING (expires_at > now());

CREATE POLICY "Anyone can update scan sessions"
  ON scan_sessions
  FOR UPDATE
  TO public
  USING (expires_at > now())
  WITH CHECK (expires_at > now());

CREATE INDEX idx_scan_sessions_session_id ON scan_sessions(session_id);
CREATE INDEX idx_scan_sessions_expires_at ON scan_sessions(expires_at);

CREATE OR REPLACE FUNCTION delete_expired_scan_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM scan_sessions
  WHERE expires_at < now();
END;
$$;