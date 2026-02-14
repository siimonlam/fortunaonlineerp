/*
  # Fix Service Creation Logic
  
  1. Changes
    - Fix upsert logic to check by invoice_number instead of id
    - Properly update existing service records
    - Handle cases where invoice is paid multiple times
*/

-- Drop and recreate function with correct upsert logic
CREATE OR REPLACE FUNCTION create_service_from_paid_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_service_type TEXT;
  v_service_name TEXT;
  v_company_name TEXT;
  v_existing_id UUID;
BEGIN
  -- Only proceed if status changed to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
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
        status = CASE 
          WHEN NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE THEN 'inactive'
          ELSE 'active'
        END,
        monthly_fee = NEW.amount,
        company_code = NEW.company_code,
        company_name = v_company_name,
        updated_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      -- Insert new record
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
        CASE 
          WHEN NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE THEN 'inactive'
          ELSE 'active'
        END,
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
