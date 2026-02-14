/*
  # Auto-create Service Records from Paid Invoices
  
  1. Trigger Function
    - When comsec_invoice status changes to 'paid'
    - Automatically insert/update record in virtual_office table
    - Maps invoice data to service subscription
  
  2. Status Management
    - Services with end_date in the past automatically set to 'inactive'
    - Active services have 'active' status
  
  3. Service Tracking
    - Links service_id from invoice to virtual_office
    - Maintains start_date, end_date, and renewal_date
*/

-- Function to create/update virtual office service when invoice is paid
CREATE OR REPLACE FUNCTION create_service_from_paid_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Insert or update service record in virtual_office
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
      (SELECT service_type FROM comsec_services WHERE id = NEW.service_id),
      (SELECT service_name FROM comsec_services WHERE id = NEW.service_id),
      NEW.description,
      NEW.start_date,
      NEW.end_date,
      NEW.end_date, -- renewal_date same as end_date initially
      CASE 
        WHEN NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE THEN 'inactive'
        ELSE 'active'
      END,
      NEW.amount, -- monthly_fee from invoice amount
      NEW.invoice_number,
      NEW.company_code,
      (SELECT company_name_english FROM comsec_clients WHERE id = NEW.comsec_client_id),
      NEW.created_by,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      renewal_date = EXCLUDED.renewal_date,
      status = EXCLUDED.status,
      monthly_fee = EXCLUDED.monthly_fee,
      updated_at = NOW();
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on comsec_invoices
DROP TRIGGER IF EXISTS trigger_create_service_on_invoice_paid ON comsec_invoices;
CREATE TRIGGER trigger_create_service_on_invoice_paid
  AFTER INSERT OR UPDATE OF status ON comsec_invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_service_from_paid_invoice();

-- Function to auto-update service status based on end_date
CREATE OR REPLACE FUNCTION update_expired_service_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If end_date is in the past, set status to inactive
  IF NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE AND NEW.status != 'inactive' THEN
    NEW.status := 'inactive';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update status on insert/update
DROP TRIGGER IF EXISTS trigger_update_expired_service_status ON virtual_office;
CREATE TRIGGER trigger_update_expired_service_status
  BEFORE INSERT OR UPDATE OF end_date ON virtual_office
  FOR EACH ROW
  EXECUTE FUNCTION update_expired_service_status();

-- Create periodic check function to update all expired services
CREATE OR REPLACE FUNCTION check_and_update_expired_services()
RETURNS void AS $$
BEGIN
  UPDATE virtual_office
  SET status = 'inactive', updated_at = NOW()
  WHERE end_date IS NOT NULL 
    AND end_date < CURRENT_DATE 
    AND status != 'inactive';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for clarity
COMMENT ON TABLE virtual_office IS 'Stores all paid services including virtual office and company secretary services';
