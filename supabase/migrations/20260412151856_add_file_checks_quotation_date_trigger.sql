/*
  # Add trigger on project_checklist_file_checks to re-run quotation date checks

  ## Summary
  When any row in `project_checklist_file_checks` is inserted or updated for a
  Quotation document type, this trigger calls the `check-quotation-dates` edge
  function with the `checklist_item_id`. This causes the function to re-evaluate
  ALL files under that checklist item (not just the one that changed), ensuring
  every vendor quotation in the same item is validated against:
    1. Being within the project period (start → end date)
    2. Being no more than 1 month before the project start date

  ## Details
  - Trigger fires AFTER INSERT OR UPDATE on `project_checklist_file_checks`
  - Only activates when `document_type` starts with 'Quotation'
  - Passes `checklist_item_id` so the edge function checks the whole item group
  - Non-blocking: uses pg_net async HTTP; errors are swallowed
*/

CREATE OR REPLACE FUNCTION trigger_check_quotation_dates_from_file_checks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text := 'https://yostyonvexbzlgedbfgq.supabase.co';
  _anon_key     text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY';
BEGIN
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

DROP TRIGGER IF EXISTS quotation_date_check_from_file_checks_trigger ON project_checklist_file_checks;

CREATE TRIGGER quotation_date_check_from_file_checks_trigger
  AFTER INSERT OR UPDATE
  ON project_checklist_file_checks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_quotation_dates_from_file_checks();
