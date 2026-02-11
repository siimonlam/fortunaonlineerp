/*
  # Auto-update Com Sec Client Status on Payment

  1. Changes
    - Create trigger to move Com Sec clients to "Active" status when invoice is paid
    - Also check if client has no active services and move to "Pending Renewal" if needed

  2. Business Logic
    - When invoice status changes to 'paid', set client status to 'Active'
    - When all services expire (end_date < today), set client status to 'Pending Renewal'
*/

-- Function to update Com Sec client status when invoice is paid
CREATE OR REPLACE FUNCTION update_comsec_client_status_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_comsec_project_id uuid;
  v_active_status_id uuid;
  v_pending_renewal_status_id uuid;
  v_has_active_services boolean;
BEGIN
  -- Only proceed if status changed to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Get Com Sec Project type ID
    SELECT id INTO v_comsec_project_id
    FROM project_types
    WHERE name = 'Com Sec';

    -- Get Active status ID for Com Sec
    SELECT id INTO v_active_status_id
    FROM statuses
    WHERE name = 'Active' 
      AND project_type_id = v_comsec_project_id
      AND is_substatus = false;

    -- Update the client status to Active
    IF v_active_status_id IS NOT NULL AND NEW.comsec_client_id IS NOT NULL THEN
      UPDATE comsec_clients
      SET status_id = v_active_status_id
      WHERE id = NEW.comsec_client_id;
    END IF;
  END IF;

  -- Check if client has any active services
  -- A service is active if end_date is in the future or NULL (ongoing)
  IF NEW.comsec_client_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM comsec_invoices 
      WHERE comsec_client_id = NEW.comsec_client_id
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    ) INTO v_has_active_services;

    -- If no active services, move to Pending Renewal
    IF NOT v_has_active_services THEN
      -- Get Com Sec Project type ID (if not already fetched)
      IF v_comsec_project_id IS NULL THEN
        SELECT id INTO v_comsec_project_id
        FROM project_types
        WHERE name = 'Com Sec';
      END IF;

      -- Get Pending Renewal status ID for Com Sec
      SELECT id INTO v_pending_renewal_status_id
      FROM statuses
      WHERE name = 'Pending Renewal' 
        AND project_type_id = v_comsec_project_id
        AND is_substatus = false;

      -- Update the client status to Pending Renewal
      IF v_pending_renewal_status_id IS NOT NULL THEN
        UPDATE comsec_clients
        SET status_id = v_pending_renewal_status_id
        WHERE id = NEW.comsec_client_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for invoice status updates
DROP TRIGGER IF EXISTS trigger_update_comsec_status_on_payment ON comsec_invoices;
CREATE TRIGGER trigger_update_comsec_status_on_payment
  AFTER INSERT OR UPDATE OF status, end_date ON comsec_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_comsec_client_status_on_payment();
