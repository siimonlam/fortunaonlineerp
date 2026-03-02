/*
  # Add ComSec Receipt Template Setting

  1. Changes
    - Adds system setting for ComSec receipt Google Docs template URL
    - This template will be used to generate receipt PDFs by filling in placeholders

  2. Notes
    - Template should be a Google Doc with placeholders like {{RECEIPT_NUMBER}}, {{CLIENT_NAME}}, etc.
    - Default template: https://docs.google.com/document/d/1nY7Io90NNpYzyXN4q9aEJGSRWuc_EQI9bxreNq0FTQM/
*/

INSERT INTO system_settings (key, value, description)
VALUES (
  'comsec_receipt_template_url',
  'https://docs.google.com/document/d/1nY7Io90NNpYzyXN4q9aEJGSRWuc_EQI9bxreNq0FTQM/',
  'Google Docs template URL for ComSec receipts. The template should contain placeholders: {{RECEIPT_NUMBER}}, {{CLIENT_NAME}}, {{AMOUNT}}, {{PAYMENT_DATE}}, {{PAYMENT_METHOD}}, etc.'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;
