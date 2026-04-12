/*
  # Fix quotation date check trigger with hardcoded Supabase URL

  ## Summary
  Replaces the previous trigger that used `current_setting()` (which returns null)
  with the hardcoded URL/anon key pattern used consistently across this project.

  ## Changes
  - Recreates `trigger_check_quotation_dates()` using the hardcoded Supabase URL
  - Fires AFTER INSERT OR UPDATE OF extracted_data on project_checklist_files
  - Only runs for rows where document_type LIKE 'Quotation%' AND extracted_data has quotation_date
  - Calls the `check-quotation-dates` edge function asynchronously via pg_net
  - Non-blocking: any error is caught and the transaction is never blocked
*/

CREATE OR REPLACE FUNCTION trigger_check_quotation_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text := 'https://yostyonvexbzlgedbfgq.supabase.co';
  _anon_key     text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY';
BEGIN
  IF NEW.document_type IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (NEW.document_type LIKE 'Quotation%') THEN
    RETURN NEW;
  END IF;
  IF NEW.extracted_data IS NULL
     OR NEW.extracted_data->>'quotation_date' IS NULL
     OR NEW.extracted_data->>'quotation_date' = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := _supabase_url || '/functions/v1/check-quotation-dates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'apikey', _anon_key
    ),
    body    := jsonb_build_object('file_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotation_date_check_trigger ON project_checklist_files;

CREATE TRIGGER quotation_date_check_trigger
  AFTER INSERT OR UPDATE OF extracted_data
  ON project_checklist_files
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_quotation_dates();
