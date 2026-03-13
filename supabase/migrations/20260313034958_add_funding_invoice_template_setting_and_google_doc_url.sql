/*
  # Add Funding Invoice Google Doc Template Support

  1. Changes
    - Inserts a `funding_invoice_template_doc_id` key into `system_settings` (if not already present)
      so admins can configure the Google Doc template ID via Admin > System Settings.
    - Adds `google_doc_url` column to `funding_invoice` table to store the editable Google Doc link.

  2. Notes
    - The system_settings insert uses ON CONFLICT DO NOTHING so it won't overwrite an existing value.
    - The column addition is guarded with IF NOT EXISTS.
*/

INSERT INTO system_settings (key, value, description)
VALUES (
  'funding_invoice_template_doc_id',
  '',
  'Google Doc template ID for generating funding invoices. Set this to the document ID from the template URL.'
)
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funding_invoice' AND column_name = 'google_doc_url'
  ) THEN
    ALTER TABLE funding_invoice ADD COLUMN google_doc_url text;
  END IF;
END $$;
