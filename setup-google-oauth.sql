-- Insert your Google OAuth access token
-- Replace 'YOUR_ACCESS_TOKEN_HERE' with the actual token from OAuth Playground

INSERT INTO google_oauth_credentials (service_name, access_token, refresh_token)
VALUES ('google_drive', 'YOUR_ACCESS_TOKEN_HERE', NULL)
ON CONFLICT (service_name) 
DO UPDATE SET 
  access_token = EXCLUDED.access_token,
  updated_at = now();
