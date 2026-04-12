/*
  # Add trigger to auto-check quotation dates via Edge Function

  ## Summary
  Creates a database trigger that automatically calls the `check-quotation-dates`
  edge function whenever a `project_checklist_files` row is inserted or updated,
  but only for Quotation documents that have extracted quotation_date data.

  ## Details
  - Trigger fires AFTER INSERT OR UPDATE on `project_checklist_files`
  - Only activates when `document_type` starts with 'Quotation'
  - Only activates when `extracted_data->>'quotation_date'` is present
  - Uses `pg_net` to make async HTTP call to the edge function
  - Non-blocking: uses EdgeRuntime.waitUntil pattern via net.http_post
*/

CREATE OR REPLACE FUNCTION trigger_check_quotation_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _url text;
  _key text;
BEGIN
  -- Only process Quotation documents with an extracted quotation_date
  IF NEW.document_type IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (NEW.document_type LIKE 'Quotation%') THEN
    RETURN NEW;
  END IF;
  IF NEW.extracted_data IS NULL OR NEW.extracted_data->>'quotation_date' IS NULL OR NEW.extracted_data->>'quotation_date' = '' THEN
    RETURN NEW;
  END IF;

  _url := current_setting('app.supabase_url', true);
  _key := current_setting('app.service_role_key', true);

  -- Fallback to env-style settings if custom ones not set
  IF _url IS NULL OR _url = '' THEN
    _url := Deno.env.get('SUPABASE_URL');
  END IF;

  -- Use pg_net for async HTTP (non-blocking)
  PERFORM net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/check-quotation-dates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := jsonb_build_object('file_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the transaction
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotation_date_check_trigger ON project_checklist_files;

CREATE TRIGGER quotation_date_check_trigger
  AFTER INSERT OR UPDATE OF extracted_data
  ON project_checklist_files
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_quotation_dates();
