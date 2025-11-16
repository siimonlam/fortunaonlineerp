/*
  # Add Google Drive URL to Funding Invoice

  1. Changes
    - Add `google_drive_url` column to `funding_invoice` table
      - Type: text
      - Nullable: true
      - Stores the Google Drive link to the invoice PDF

  2. Notes
    - This allows tracking where invoice PDFs are stored in Google Drive
    - Users can click the link to view the invoice directly in Google Drive
*/

-- Add google_drive_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funding_invoice' AND column_name = 'google_drive_url'
  ) THEN
    ALTER TABLE funding_invoice ADD COLUMN google_drive_url text;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_funding_invoice_google_drive_url ON funding_invoice(google_drive_url) WHERE google_drive_url IS NOT NULL;