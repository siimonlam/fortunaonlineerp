/*
  # Update Service Creation Trigger
  
  1. Changes
    - Trigger on both pdf_url AND google_drive_url changes
    - This handles both PDF and Google Drive document workflows
  
  2. Behavior
    - Service created when either pdf_url or google_drive_url is set
    - Initial status is 'pending'
    - Status becomes 'active' when invoice is paid
*/

-- Drop old trigger
DROP TRIGGER IF EXISTS trigger_create_service_on_pdf_generation ON comsec_invoices;

-- Update function to check both pdf_url and google_drive_url
CREATE OR REPLACE FUNCTION create_service_on_pdf_generation()
RETURNS TRIGGER AS $$
DECLARE
  v_service_type TEXT;
  v_service_name TEXT;
  v_company_name TEXT;
  v_existing_id UUID;
  v_new_status TEXT;
  v_has_document BOOLEAN;
  v_had_document BOOLEAN;
BEGIN
  -- Check if a document (PDF or Google Drive) is set
  v_has_document := (NEW.pdf_url IS NOT NULL AND NEW.pdf_url != '') OR 
                    (NEW.google_drive_url IS NOT NULL AND NEW.google_drive_url != '');
  
  v_had_document := (OLD.pdf_url IS NOT NULL AND OLD.pdf_url != '') OR 
                    (OLD.google_drive_url IS NOT NULL AND OLD.google_drive_url != '');
  
  -- Only proceed if a document was just generated
  IF v_has_document AND NOT v_had_document THEN
    
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

-- Create trigger for both pdf_url and google_drive_url
CREATE TRIGGER trigger_create_service_on_pdf_generation
  AFTER INSERT OR UPDATE OF pdf_url, google_drive_url ON comsec_invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_service_on_pdf_generation();

COMMENT ON FUNCTION create_service_on_pdf_generation IS 'Creates service record when PDF or Google Drive document is generated (not on draft)';
