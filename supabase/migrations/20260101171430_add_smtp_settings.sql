/*
  # Add SMTP Email Settings

  1. Purpose
    - Add SMTP configuration to system_settings for production email sending
    - Store SMTP server credentials and configuration

  2. Settings Added
    - `smtp_host` - SMTP server hostname (e.g., smtp.gmail.com)
    - `smtp_port` - SMTP server port (e.g., 587 for TLS)
    - `smtp_secure` - Use TLS/SSL (true/false)
    - `smtp_user` - SMTP authentication username
    - `smtp_password` - SMTP authentication password (encrypted)
    - `smtp_from_email` - Default sender email address
    - `smtp_from_name` - Default sender name

  3. Security
    - Settings protected by RLS (admin only)
    - Service role can read for edge functions
*/

-- Insert SMTP settings with default values (to be configured by admin)
INSERT INTO system_settings (key, value, description) VALUES
  ('smtp_host', '', 'SMTP server hostname (e.g., smtp.gmail.com)'),
  ('smtp_port', '587', 'SMTP server port (587 for TLS, 465 for SSL, 25 for plain)'),
  ('smtp_secure', 'true', 'Use TLS/SSL encryption (true/false)'),
  ('smtp_user', '', 'SMTP authentication username'),
  ('smtp_password', '', 'SMTP authentication password'),
  ('smtp_from_email', '', 'Default sender email address'),
  ('smtp_from_name', 'Your Company', 'Default sender name')
ON CONFLICT (key) DO NOTHING;
