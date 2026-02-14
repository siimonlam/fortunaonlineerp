/*
  # Fix Service Creation: Use company_name with Chinese Fallback
  
  1. Changes
    - Update trigger to use `company_name` instead of `company_name_english`
    - Fall back to `company_name_chinese` if `company_name` is null or empty
    - Prevents PDF generation errors when only Chinese company name exists
*/

-- Update the service creation trigger to use correct column names
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
    
    -- Determine initial status: start as 'inactive' unless already paid
    v_new_status := CASE 
      WHEN NEW.status = 'Paid' THEN 'active'
      WHEN NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE THEN 'inactive'
      ELSE 'inactive'
    END;
    
    -- Get service details
    SELECT service_type, service_name 
    INTO v_service_type, v_service_name
    FROM comsec_services 
    WHERE id = NEW.service_id;
    
    -- Get company name, using English name first, falling back to Chinese name
    SELECT COALESCE(NULLIF(company_name, ''), company_name_chinese)
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
      -- Insert new record with 'inactive' status
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

COMMENT ON FUNCTION create_service_on_pdf_generation IS 'Creates service record when PDF is generated, using company_name with Chinese fallback';
