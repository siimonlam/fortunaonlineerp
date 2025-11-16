/*
  # Direct status change when deposit is paid

  1. Changes
    - Replace async edge function call with direct database update
    - When deposit invoice is marked paid, directly execute automation rules
    - More reliable than HTTP calls via pg_net

  2. How it works
    - Trigger fires when deposit invoice payment_status changes to 'Paid'
    - Looks up matching automation rules directly in database
    - Applies the status change immediately in the same transaction

  3. Notes
    - Simpler and more reliable than async HTTP approach
    - Executes in same transaction so changes are immediate
    - Still respects automation rule conditions
*/

CREATE OR REPLACE FUNCTION execute_deposit_paid_automation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  project_record record;
  status_record record;
  main_status_name text;
  automation_rule record;
BEGIN
  -- Only trigger if this is a deposit invoice being marked as paid
  IF NEW.payment_type = 'Deposit' 
     AND NEW.payment_status = 'Paid' 
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
    
    -- Get the project information
    SELECT p.id, p.project_type_id, p.status_id, p.sales_source, p.sales_person_id
    INTO project_record
    FROM projects p
    WHERE p.id = NEW.project_id;
    
    IF NOT FOUND THEN
      RAISE LOG 'Project not found for invoice %', NEW.invoice_number;
      RETURN NEW;
    END IF;

    -- Get the project's current status
    SELECT s.id, s.name, s.parent_status_id
    INTO status_record
    FROM statuses s
    WHERE s.id = project_record.status_id;

    IF NOT FOUND THEN
      RAISE LOG 'Status not found for project %', project_record.id;
      RETURN NEW;
    END IF;

    -- Determine main status name
    main_status_name := status_record.name;
    IF status_record.parent_status_id IS NOT NULL THEN
      SELECT name INTO main_status_name
      FROM statuses
      WHERE id = status_record.parent_status_id;
    END IF;

    RAISE LOG 'Looking for deposit_paid automation rules for main_status: %', main_status_name;

    -- Find matching automation rules
    FOR automation_rule IN
      SELECT *
      FROM automation_rules
      WHERE trigger_type = 'deposit_paid'
        AND is_active = true
        AND main_status = main_status_name
        AND (project_type_id = project_record.project_type_id OR project_type_id IS NULL)
    LOOP
      RAISE LOG 'Found automation rule: %', automation_rule.name;

      -- Check conditions
      IF automation_rule.condition_type = 'sales_source' THEN
        IF automation_rule.condition_config->>'sales_source' IS NOT NULL 
           AND project_record.sales_source != automation_rule.condition_config->>'sales_source' THEN
          RAISE LOG 'Skipping rule - sales source mismatch';
          CONTINUE;
        END IF;
      END IF;

      IF automation_rule.condition_type = 'sales_person' THEN
        IF automation_rule.condition_config->>'sales_person_id' IS NOT NULL 
           AND project_record.sales_person_id::text != automation_rule.condition_config->>'sales_person_id' THEN
          RAISE LOG 'Skipping rule - sales person mismatch';
          CONTINUE;
        END IF;
      END IF;

      -- Execute the action
      IF automation_rule.action_type = 'change_status' THEN
        DECLARE
          new_status_id text;
        BEGIN
          new_status_id := automation_rule.action_config->>'status_id';
          
          IF new_status_id IS NOT NULL THEN
            UPDATE projects
            SET status_id = new_status_id::uuid,
                updated_at = now()
            WHERE id = project_record.id;
            
            RAISE LOG 'Changed project % status to %', project_record.id, new_status_id;
          END IF;
        END;
      END IF;

      -- Note: Other action types (add_label, add_task, etc.) can be added here if needed
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace the existing trigger
DROP TRIGGER IF EXISTS on_invoice_payment_change ON funding_invoice;

CREATE TRIGGER on_invoice_payment_change
  AFTER INSERT OR UPDATE OF payment_status ON funding_invoice
  FOR EACH ROW
  EXECUTE FUNCTION execute_deposit_paid_automation();
