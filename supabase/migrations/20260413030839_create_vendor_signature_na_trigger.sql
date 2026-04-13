/*
  # Auto-mark non-selected vendor signature/stamp checks as N/A

  ## Summary
  When a "Quotation 報價" file check for description "供應商簽名" or "供應商蓋印"
  is set to checked (is_checked = true OR is_checked_by_ai = true), automatically
  mark the same check descriptions on ALL OTHER files sharing the same checklist_item_id
  as N/A - Non-Selected Vendor (is_checked_by_ai = true, ai_result = 'N/A - Non-Selected Vendor').

  This mirrors the existing vendor-selection logic but triggers on the check itself,
  not just on the is_selected_vendor flag.

  ## Logic
  - Trigger fires AFTER INSERT OR UPDATE on project_checklist_file_checks
  - Only activates when:
    - document_type = 'Quotation 報價'
    - description IN ('供應商簽名', '供應商蓋印')
    - is_checked = true OR is_checked_by_ai = true
    - ai_result IS DISTINCT FROM 'N/A - Non-Selected Vendor' (avoid recursion)
  - Finds all other file_ids with the same checklist_item_id
  - Sets is_checked_by_ai = true, ai_result = 'N/A - Non-Selected Vendor'
    for matching description rows on those other files
*/

CREATE OR REPLACE FUNCTION fn_mark_non_selected_vendor_checks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_checklist_item_id uuid;
BEGIN
  -- Only act on Quotation 報價 vendor signature/stamp checks that are now checked
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

  -- Skip rows that are already the N/A result (prevents recursion)
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

DROP TRIGGER IF EXISTS trg_mark_non_selected_vendor_checks ON project_checklist_file_checks;

CREATE TRIGGER trg_mark_non_selected_vendor_checks
AFTER INSERT OR UPDATE OF is_checked, is_checked_by_ai
ON project_checklist_file_checks
FOR EACH ROW
EXECUTE FUNCTION fn_mark_non_selected_vendor_checks();
