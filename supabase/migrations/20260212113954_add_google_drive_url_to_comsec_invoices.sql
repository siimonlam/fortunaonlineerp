/*
  # Add Google Drive URL to ComSec Invoices

  1. Changes
    - Add google_drive_url column to comsec_invoices table to store the link to the Google Doc invoice

  2. New Fields
    - google_drive_url (text) - URL to the Google Docs invoice

  3. Important Notes
    - Existing invoices without Google Drive links will have null values
    - This allows tracking of both PDF storage and Google Docs versions
*/

-- Add google_drive_url field to comsec_invoices
ALTER TABLE comsec_invoices
ADD COLUMN IF NOT EXISTS google_drive_url text;

-- Create index for google_drive_url
CREATE INDEX IF NOT EXISTS idx_comsec_invoices_google_drive_url ON comsec_invoices(google_drive_url);
