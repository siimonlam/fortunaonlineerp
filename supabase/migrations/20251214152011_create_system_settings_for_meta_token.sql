/*
  # Create System Settings Table for Meta Integration

  1. New Table
    - `system_settings`
      - `key` (text, primary key) - Setting identifier (e.g., 'meta_system_user_token')
      - `value` (text) - Setting value (encrypted sensitive data)
      - `description` (text) - Description of the setting
      - `updated_at` (timestamptz) - Last update timestamp
      - `updated_by` (uuid) - User who last updated

  2. Security
    - Enable RLS
    - Only admins can read/write system settings
    - Service role can read for edge functions
*/

CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view system settings
CREATE POLICY "Admins can view system settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can insert system settings
CREATE POLICY "Admins can insert system settings"
  ON system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can update system settings
CREATE POLICY "Admins can update system settings"
  ON system_settings
  FOR UPDATE
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

-- Service role can read for edge functions
CREATE POLICY "Service role can read system settings"
  ON system_settings
  FOR SELECT
  TO service_role
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;