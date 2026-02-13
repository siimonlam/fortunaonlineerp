/*
  # Add PDF URL to ComSec Invoices

  1. Changes
    - Add pdf_url field to comsec_invoices table to store the Supabase Storage URL for generated PDFs

  2. New Fields
    - **pdf_url** (text, nullable): URL to the generated PDF in Supabase Storage

  3. Invoice Workflow
    - **Draft**: Invoice created with Google Docs (google_drive_url exists, pdf_url is null, status = 'Draft')
    - **Ready to Send**: PDF generated from Google Doc (pdf_url exists, status = 'Unpaid')

  4. Important Notes
    - google_drive_url: Editable Google Docs version
    - pdf_url: Final PDF for sending to clients
    - Both fields can coexist - Google Doc is the source, PDF is the distribution format
*/

-- Add pdf_url field to comsec_invoices
ALTER TABLE comsec_invoices
ADD COLUMN IF NOT EXISTS pdf_url text;

-- Create index for pdf_url lookups
CREATE INDEX IF NOT EXISTS idx_comsec_invoices_pdf_url ON comsec_invoices(pdf_url);

-- Add comment for documentation
COMMENT ON COLUMN comsec_invoices.pdf_url IS 'URL to the generated PDF stored in Supabase Storage (comsec-documents/invoices/{invoice_number}.pdf)';
COMMENT ON COLUMN comsec_invoices.google_drive_url IS 'URL to the editable Google Docs version (draft stage)';
