/*
  # Add funding invoice folder ID setting

  Adds a new system_settings row for the optional Google Drive folder ID
  where funding invoice documents and PDFs will be saved.
  If not set, files are saved to the service account root drive.
*/
INSERT INTO system_settings (key, value)
VALUES ('funding_invoice_folder_id', '')
ON CONFLICT (key) DO NOTHING;
