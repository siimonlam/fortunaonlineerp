/*
  # Add trigger on projects to re-run quotation date checks when project dates change

  ## Summary
  When a project's start date (project_start_date / start_date) or end date
  (project_end_date) is updated, this trigger calls the `check-quotation-dates`
  edge function with the project_id so every quotation file in that project is
  re-validated against the new dates.

  ## Details
  - Fires AFTER UPDATE OF project_start_date, start_date, project_end_date on projects
  - Only fires when at least one of those three columns actually changed value
  - Calls the edge function asynchronously via pg_net (non-blocking)
  - Errors are caught and the transaction is never blocked
*/

CREATE OR REPLACE FUNCTION trigger_check_quotation_dates_on_project_date_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text := 'https://yostyonvexbzlgedbfgq.supabase.co';
  _anon_key     text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvc3R5b252ZXhiemxnZWRiZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MjE4ODgsImV4cCI6MjA3NjM5Nzg4OH0.zwVKORKDL414ON3QjXFiAfq44aOlPwTfwpOFgwQkYOY';
BEGIN
  -- Only fire when a date column actually changed
  IF (
    (OLD.project_start_date IS DISTINCT FROM NEW.project_start_date) OR
    (OLD.start_date IS DISTINCT FROM NEW.start_date) OR
    (OLD.project_end_date IS DISTINCT FROM NEW.project_end_date)
  ) THEN
    PERFORM net.http_post(
      url     := _supabase_url || '/functions/v1/check-quotation-dates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key,
        'apikey', _anon_key
      ),
      body    := jsonb_build_object('project_id', NEW.id)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotation_date_check_on_project_dates_trigger ON projects;

CREATE TRIGGER quotation_date_check_on_project_dates_trigger
  AFTER UPDATE OF project_start_date, start_date, project_end_date
  ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_quotation_dates_on_project_date_change();
