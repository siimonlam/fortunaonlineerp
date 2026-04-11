/*
  # Add document verification check columns to project_checklist_files

  Each uploaded file (e.g. a Quotation PDF inside the Quotation folder) needs
  its own set of document-level verification checks so reviewers can tick off
  whether the document has the required elements.

  ## Modified Table: project_checklist_files

  ### New columns (all nullable, default false for booleans):
  - `drive_file_id`         — Google Drive file ID (mirrors file_id but explicit naming)
  - `drive_folder_id`       — which Drive folder the file lives in
  - `file_type`             — mime type or extension (e.g. 'pdf', 'image/jpeg')
  - `file_size`             — file size in bytes

  ### Document check columns (boolean, default false):
  - `has_date`              — document shows a valid date
  - `has_chop`              — company chop / official stamp is present
  - `has_signature`         — authorised signature is present
  - `has_amount`            — monetary amount is clearly stated
  - `has_company_name`      — company name is present
  - `has_invoice_number`    — invoice / reference number is present
  - `has_correct_payee`     — payee / recipient name matches expected

  ### Check metadata columns:
  - `checks_reviewed_by`    — uuid of the user who last reviewed the checks
  - `checks_reviewed_at`    — timestamp of last review
  - `checks_notes`          — free-text notes from reviewer
  - `ai_check_result`       — jsonb: AI extracted check results (raw)
  - `is_checks_complete`    — computed flag: all required checks passed

  ## Notes
  - All check columns default to false (unchecked)
  - Existing rows are unaffected; new columns are nullable or have safe defaults
*/

DO $$
BEGIN
  -- Drive metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'drive_folder_id') THEN
    ALTER TABLE project_checklist_files ADD COLUMN drive_folder_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'file_type') THEN
    ALTER TABLE project_checklist_files ADD COLUMN file_type text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'file_size') THEN
    ALTER TABLE project_checklist_files ADD COLUMN file_size bigint;
  END IF;

  -- Document check booleans
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'has_date') THEN
    ALTER TABLE project_checklist_files ADD COLUMN has_date boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'has_chop') THEN
    ALTER TABLE project_checklist_files ADD COLUMN has_chop boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'has_signature') THEN
    ALTER TABLE project_checklist_files ADD COLUMN has_signature boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'has_amount') THEN
    ALTER TABLE project_checklist_files ADD COLUMN has_amount boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'has_company_name') THEN
    ALTER TABLE project_checklist_files ADD COLUMN has_company_name boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'has_invoice_number') THEN
    ALTER TABLE project_checklist_files ADD COLUMN has_invoice_number boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'has_correct_payee') THEN
    ALTER TABLE project_checklist_files ADD COLUMN has_correct_payee boolean NOT NULL DEFAULT false;
  END IF;

  -- Review metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'checks_reviewed_by') THEN
    ALTER TABLE project_checklist_files ADD COLUMN checks_reviewed_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'checks_reviewed_at') THEN
    ALTER TABLE project_checklist_files ADD COLUMN checks_reviewed_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'checks_notes') THEN
    ALTER TABLE project_checklist_files ADD COLUMN checks_notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'ai_check_result') THEN
    ALTER TABLE project_checklist_files ADD COLUMN ai_check_result jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_checklist_files' AND column_name = 'is_checks_complete') THEN
    ALTER TABLE project_checklist_files ADD COLUMN is_checks_complete boolean NOT NULL DEFAULT false;
  END IF;
END $$;
