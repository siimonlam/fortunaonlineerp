/*
  # Service Creation: PDF Only (Not Draft)
  
  1. Workflow
    - Draft invoice with google_drive_url → NO service record
    - PDF generated (pdf_url set) → Create service with status='pending'
    - Invoice paid → Update service status to 'active'
  
  2. Changes
    - Only trigger on pdf_url changes (not google_drive_url)
    - Google Drive URL is for drafts that are still editable
    - PDF URL means invoice is finalized
*/

-- Drop old trigger
DROP TRIGGER IF EXISTS trigger_create_service_on_pdf_generation ON comsec_invoices;

-- Update function to ONLY check pdf_url (not google_drive_url)
CREATE OR REPLACE FUNCTION create_service_on_pdf_generation()
RETURNS TRIGGER AS $$
DECLARE
  v_service_type TEXT;
  v_service_name TEXT;
  v_company_name TEXT;
  v_existing_id UUID;
  v_new_status TEXT;
BEGIN
  -- Only proceed if pdf_url is set (PDF generated, not draft)
  IF NEW.pdf_url IS NOT NULL AND NEW.pdf_url != '' AND 
     (OLD.pdf_url IS NULL OR OLD.pdf_url = '') THEN
    
    -- Determine initial status
    v_new_status := CASE 
      WHEN NEW.status = 'paid' THEN 'active'
      WHEN NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE THEN 'inactive'
      ELSE 'pending'
    END;
    
    -- Get service details
    SELECT service_type, service_name 
    INTO v_service_type, v_service_name
    FROM comsec_services 
    WHERE id = NEW.service_id;
    
    -- Get company name
    SELECT company_name_english 
    INTO v_company_name
    FROM comsec_clients 
    WHERE id = NEW.comsec_client_id;
    
    -- Check if service record already exists for this invoice
    SELECT id INTO v_existing_id
    FROM virtual_office
    WHERE invoice_number = NEW.invoice_number;
    
    IF v_existing_id IS NOT NULL THEN
      -- Update existing record
      UPDATE virtual_office SET
        comsec_client_id = NEW.comsec_client_id,
        service_id = NEW.service_id,
        service_type = v_service_type,
        service_name = v_service_name,
        service_description = NEW.description,
        start_date = NEW.start_date,
        end_date = NEW.end_date,
        renewal_date = NEW.end_date,
        status = v_new_status,
        monthly_fee = NEW.amount,
        company_code = NEW.company_code,
        company_name = v_company_name,
        updated_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      -- Insert new record with 'pending' status
      INSERT INTO virtual_office (
        id,
        comsec_client_id,
        service_id,
        service_type,
        service_name,
        service_description,
        start_date,
        end_date,
        renewal_date,
        status,
        monthly_fee,
        invoice_number,
        company_code,
        company_name,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        NEW.comsec_client_id,
        NEW.service_id,
        v_service_type,
        v_service_name,
        NEW.description,
        NEW.start_date,
        NEW.end_date,
        NEW.end_date,
        v_new_status,
        NEW.amount,
        NEW.invoice_number,
        NEW.company_code,
        v_company_name,
        NEW.created_by,
        NOW(),
        NOW()
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger ONLY for pdf_url changes
CREATE TRIGGER trigger_create_service_on_pdf_generation
  AFTER INSERT OR UPDATE OF pdf_url ON comsec_invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_service_on_pdf_generation();

COMMENT ON FUNCTION create_service_on_pdf_generation IS 'Creates service record when PDF is generated (not for Google Drive drafts)';
