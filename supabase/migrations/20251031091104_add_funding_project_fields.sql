/*
  # Add Funding Project Fields

  1. New Columns Added to Projects Table
    - start_date: Project start date
    - sales_source: Sales source (renamed from lead_source for clarity)
    - sales_person_id: Reference to staff table (replacing text sales_person)
    - attachment: File attachment reference
    - deposit_paid: Boolean flag for deposit payment status
    - deposit_amount: Deposit amount in decimal
    - project_name: Alternative project identifier
    - service_fee_percentage: Service fee as percentage
    - whatsapp_group_id: WhatsApp group identifier
    - invoice_number: Invoice reference number
    - agreement_ref: Agreement reference
    - abbreviation: Project abbreviation
    - project_size: Size/scale of project
    - project_start_date: Official project start date
    - project_end_date: Official project end date
    - submission_date: Submission date
    - application_number: Application reference number
    - approval_date: Approval date
    - next_hkpc_due_date: Next HKPC due date
    - next_due_date: General next due date

  2. Notes
    - Existing fields are preserved: title, description, status_id, client_id, 
      company_name, contact_name, contact_number, email, address, upload_link
    - sales_person changed from text to uuid reference to staff table
*/

-- Add new columns if they don't exist
DO $$
BEGIN
  -- Start Date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN start_date date;
  END IF;

  -- Rename lead_source to sales_source if lead_source exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'lead_source'
  ) THEN
    ALTER TABLE projects RENAME COLUMN lead_source TO sales_source;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'sales_source'
  ) THEN
    ALTER TABLE projects ADD COLUMN sales_source text;
  END IF;

  -- Change sales_person from text to uuid reference
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'sales_person' AND data_type = 'text'
  ) THEN
    ALTER TABLE projects DROP COLUMN sales_person;
    ALTER TABLE projects ADD COLUMN sales_person_id uuid REFERENCES staff(id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'sales_person_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN sales_person_id uuid REFERENCES staff(id);
  END IF;

  -- Attachment
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'attachment'
  ) THEN
    ALTER TABLE projects ADD COLUMN attachment text;
  END IF;

  -- Deposit Paid
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'deposit_paid'
  ) THEN
    ALTER TABLE projects ADD COLUMN deposit_paid boolean DEFAULT false;
  END IF;

  -- Deposit Amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'deposit_amount'
  ) THEN
    ALTER TABLE projects ADD COLUMN deposit_amount decimal(12,2);
  END IF;

  -- Project Name (alternative to title)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_name'
  ) THEN
    ALTER TABLE projects ADD COLUMN project_name text;
  END IF;

  -- Service Fee Percentage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'service_fee_percentage'
  ) THEN
    ALTER TABLE projects ADD COLUMN service_fee_percentage decimal(5,2);
  END IF;

  -- WhatsApp Group ID
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'whatsapp_group_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN whatsapp_group_id text;
  END IF;

  -- Invoice Number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE projects ADD COLUMN invoice_number text;
  END IF;

  -- Agreement Reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'agreement_ref'
  ) THEN
    ALTER TABLE projects ADD COLUMN agreement_ref text;
  END IF;

  -- Abbreviation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'abbreviation'
  ) THEN
    ALTER TABLE projects ADD COLUMN abbreviation text;
  END IF;

  -- Project Size
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_size'
  ) THEN
    ALTER TABLE projects ADD COLUMN project_size text;
  END IF;

  -- Project Start Date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_start_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN project_start_date date;
  END IF;

  -- Project End Date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_end_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN project_end_date date;
  END IF;

  -- Submission Date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'submission_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN submission_date date;
  END IF;

  -- Application Number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'application_number'
  ) THEN
    ALTER TABLE projects ADD COLUMN application_number text;
  END IF;

  -- Approval Date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'approval_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN approval_date date;
  END IF;

  -- Next HKPC Due Date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'next_hkpc_due_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN next_hkpc_due_date date;
  END IF;

  -- Next Due Date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'next_due_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN next_due_date date;
  END IF;
END $$;

-- Create indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_projects_sales_person_id ON projects(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_project_start_date ON projects(project_start_date);
CREATE INDEX IF NOT EXISTS idx_projects_submission_date ON projects(submission_date);
CREATE INDEX IF NOT EXISTS idx_projects_approval_date ON projects(approval_date);
CREATE INDEX IF NOT EXISTS idx_projects_deposit_paid ON projects(deposit_paid);
