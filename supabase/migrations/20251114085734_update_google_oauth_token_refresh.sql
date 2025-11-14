/*
  # Update Google OAuth Token Refresh Function

  1. Changes
    - Update get_google_drive_token() function to check token expiration
    - Automatically refresh token if expired using refresh_token
    - Return fresh access token

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS
    - Only refreshes google_drive credentials
    - Updates token in database for reuse
*/

-- Create function to refresh Google OAuth token
CREATE OR REPLACE FUNCTION get_google_drive_token()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  cred RECORD;
  new_token TEXT;
  new_expires_at TIMESTAMPTZ;
  refresh_response JSONB;
BEGIN
  -- Get current credentials
  SELECT * INTO cred
  FROM google_oauth_credentials
  WHERE service_name = 'google_drive'
  LIMIT 1;
  
  -- Check if token exists
  IF cred IS NULL THEN
    RAISE EXCEPTION 'Google Drive credentials not found';
  END IF;
  
  -- Check if token is expired or about to expire (within 5 minutes)
  IF cred.token_expires_at < (NOW() + INTERVAL '5 minutes') THEN
    -- Token is expired or about to expire, refresh it
    RAISE NOTICE 'Access token expired, refreshing...';
    
    -- Make HTTP request to refresh token
    SELECT content::jsonb INTO refresh_response
    FROM http((
      'POST',
      'https://oauth2.googleapis.com/token',
      ARRAY[http_header('Content-Type', 'application/x-www-form-urlencoded')],
      'application/x-www-form-urlencoded',
      'client_id=1030291796653-cac8klgoqmkaqvo0odhcj12g7qhip42e.apps.googleusercontent.com&' ||
      'client_secret=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&' ||
      'refresh_token=' || cred.refresh_token || '&' ||
      'grant_type=refresh_token'
    )::http_request);
    
    -- Extract new access token
    new_token := refresh_response->>'access_token';
    
    IF new_token IS NULL THEN
      RAISE EXCEPTION 'Failed to refresh token: %', refresh_response;
    END IF;
    
    -- Calculate new expiration (tokens typically last 3600 seconds)
    new_expires_at := NOW() + INTERVAL '1 hour';
    
    -- Update database with new token
    UPDATE google_oauth_credentials
    SET access_token = new_token,
        token_expires_at = new_expires_at,
        updated_at = NOW()
    WHERE service_name = 'google_drive';
    
    RETURN new_token;
  ELSE
    -- Token is still valid
    RETURN cred.access_token;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_google_drive_token() TO authenticated, service_role, anon;