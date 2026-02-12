/*
  # Add ComSec Invoice Template Setting

  1. Changes
    - Adds system setting for ComSec invoice Google Docs template ID
    - This template will be used to generate invoice PDFs by filling in placeholders

  2. Notes
    - Template should be a Google Doc with placeholders like {{INVOICE_NUMBER}}, {{CLIENT_NAME}}, etc.
    - The document ID should be from the template stored in Google Drive
*/

INSERT INTO system_settings (key, value, description)
VALUES (
  'comsec_invoice_template_doc_id',
  '',
  'Google Docs template ID for ComSec invoices. The template should contain placeholders: {{INVOICE_NUMBER}}, {{CLIENT_NAME}}, {{CLIENT_ADDRESS}}, {{ISSUE_DATE}}, {{DUE_DATE}}, {{ITEMS}}, {{TOTAL}}, {{NOTES}}'
)
ON CONFLICT (key) DO NOTHING;
