/*
  # Fix runaway trigger cascade loop on project_checklist_file_checks

  ## Root Cause
  The trigger trg_mark_non_selected_vendor_checks was defined as:
    AFTER INSERT OR UPDATE ON project_checklist_file_checks
  
  When it ran UPDATE on other rows in the same table, those UPDATEs fired 
  the trigger again recursively. The ai_result guard was insufficient because:
  - The trigger fires on ALL columns, not just is_checked/is_checked_by_ai
  - The quotation_date_check_from_file_checks_trigger ALSO fires on every 
    UPDATE of Quotation rows, making HTTP calls to edge functions on each iteration
  
  Result: 1,462,831 updates on 58 live rows — consuming 100% disk I/O budget.

  ## Fix
  1. Rewrite trg_mark_non_selected_vendor_checks using pg_trigger_depth() to 
     prevent recursive execution entirely
  2. Add column-specific UPDATE OF guard to limit when it fires
  3. Add pg_trigger_depth() guard to quotation_date trigger too
*/

-- Fix fn_mark_non_selected_vendor_checks to prevent any recursion
CREATE OR REPLACE FUNCTION fn_mark_non_selected_vendor_checks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_checklist_item_id uuid;
BEGIN
  -- CRITICAL: Prevent recursive trigger execution entirely
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only act on Quotation 報價 vendor signature/stamp checks
  IF NEW.document_type <> 'Quotation 報價' THEN
    RETURN NEW;
  END IF;

  IF NEW.description NOT IN ('供應商簽名', '供應商蓋印') THEN
    RETURN NEW;
  END IF;

  -- Only proceed when the check is being marked as true
  IF NOT (NEW.is_checked = true OR NEW.is_checked_by_ai = true) THEN
    RETURN NEW;
  END IF;

  -- Skip rows that are already the N/A result (prevents unnecessary work)
  IF NEW.ai_result = 'N/A - Non-Selected Vendor' THEN
    RETURN NEW;
  END IF;

  -- Get the checklist_item_id for this file
  SELECT checklist_item_id INTO v_checklist_item_id
  FROM project_checklist_files
  WHERE id = NEW.file_id;

  IF v_checklist_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mark all other files in the same checklist_item with the same description as N/A
  UPDATE project_checklist_file_checks
  SET
    is_checked_by_ai = true,
    ai_result = 'N/A - Non-Selected Vendor'
  WHERE
    document_type = 'Quotation 報價'
    AND description = NEW.description
    AND file_id <> NEW.file_id
    AND file_id IN (
      SELECT id FROM project_checklist_files
      WHERE checklist_item_id = v_checklist_item_id
    )
    AND (ai_result IS DISTINCT FROM 'N/A - Non-Selected Vendor');

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger with column-specific UPDATE OF guard
DROP TRIGGER IF EXISTS trg_mark_non_selected_vendor_checks ON project_checklist_file_checks;

CREATE TRIGGER trg_mark_non_selected_vendor_checks
AFTER INSERT OR UPDATE OF is_checked, is_checked_by_ai
ON project_checklist_file_checks
FOR EACH ROW
EXECUTE FUNCTION fn_mark_non_selected_vendor_checks();

-- Fix quotation_date trigger to also guard against recursive/cascaded calls
CREATE OR REPLACE FUNCTION trigger_check_quotation_dates_from_file_checks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text := 'https://yostyonvexbzlgedbfgq.supabase.co';
  _anon_key     text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY';
BEGIN
  -- CRITICAL: Do not fire when called from within another trigger (e.g. vendor NA cascade)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only process Quotation document types
  IF NEW.document_type IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (NEW.document_type LIKE 'Quotation%') THEN
    RETURN NEW;
  END IF;
  -- Need a checklist_item_id to group files
  IF NEW.checklist_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := _supabase_url || '/functions/v1/check-quotation-dates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'apikey', _anon_key
    ),
    body    := jsonb_build_object('checklist_item_id', NEW.checklist_item_id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
