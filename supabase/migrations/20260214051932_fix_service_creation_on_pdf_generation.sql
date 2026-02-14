/*
  # Update Service Creation Logic
  
  1. Changes
    - Service created when PDF is generated (not when draft)
    - Initial status is 'pending' (not active)
    - Status changes to 'active' only when invoice is paid
    - Status changes to 'inactive' when end_date passes
  
  2. Workflow
    - Draft invoice → No service record
    - PDF generated (pdf_url set) → Create service with status 'pending'
    - Invoice paid → Update service status to 'active'
    - End date passes → Update service status to 'inactive'
*/

-- Drop old trigger
DROP TRIGGER IF EXISTS trigger_create_service_on_invoice_paid ON comsec_invoices;

-- New function: Create service when PDF is generated
CREATE OR REPLACE FUNCTION create_service_on_pdf_generation()
RETURNS TRIGGER AS $$
DECLARE
  v_service_type TEXT;
  v_service_name TEXT;
  v_company_name TEXT;
  v_existing_id UUID;
  v_new_status TEXT;
BEGIN
  -- Only proceed if pdf_url is set (PDF generated)
  IF NEW.pdf_url IS NOT NULL AND (OLD.pdf_url IS NULL OR OLD.pdf_url = '') THEN
    
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

-- New function: Update service status when invoice is paid
CREATE OR REPLACE FUNCTION update_service_on_invoice_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Update service status to 'active' (if not expired)
    UPDATE virtual_office
    SET 
      status = CASE 
        WHEN end_date IS NOT NULL AND end_date < CURRENT_DATE THEN 'inactive'
        ELSE 'active'
      END,
      updated_at = NOW()
    WHERE invoice_number = NEW.invoice_number;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger when PDF is generated
CREATE TRIGGER trigger_create_service_on_pdf_generation
  AFTER INSERT OR UPDATE OF pdf_url ON comsec_invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_service_on_pdf_generation();

-- Create trigger when invoice is paid
CREATE TRIGGER trigger_update_service_on_invoice_paid
  AFTER UPDATE OF status ON comsec_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_service_on_invoice_paid();

-- Update the expired service status function to handle 'pending' status too
CREATE OR REPLACE FUNCTION update_expired_service_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If end_date is in the past, set status to inactive (regardless of current status)
  IF NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE THEN
    NEW.status := 'inactive';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to auto-update status on insert/update
DROP TRIGGER IF EXISTS trigger_update_expired_service_status ON virtual_office;
CREATE TRIGGER trigger_update_expired_service_status
  BEFORE INSERT OR UPDATE OF end_date ON virtual_office
  FOR EACH ROW
  EXECUTE FUNCTION update_expired_service_status();

-- Update periodic check to maintain correct status for all services
CREATE OR REPLACE FUNCTION check_and_update_expired_services()
RETURNS void AS $$
BEGIN
  -- Set expired services to inactive
  UPDATE virtual_office
  SET status = 'inactive', updated_at = NOW()
  WHERE end_date IS NOT NULL 
    AND end_date < CURRENT_DATE 
    AND status != 'inactive';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_service_on_pdf_generation IS 'Creates service record when PDF invoice is generated (not on draft)';
COMMENT ON FUNCTION update_service_on_invoice_paid IS 'Updates service status to active when invoice is paid';
