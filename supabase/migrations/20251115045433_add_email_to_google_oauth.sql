/*
  # Add email field to google_oauth_credentials

  1. Changes
    - Add `email` column to store the Google account email
    - This helps identify which account is authenticated
*/

ALTER TABLE google_oauth_credentials
ADD COLUMN IF NOT EXISTS email text;