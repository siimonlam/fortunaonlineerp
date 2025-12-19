/*
  # Fix Marketing Project History Tracking

  1. Changes
    - Update track_marketing_project_changes function to insert into marketing_project_history table
    - Previously was trying to insert into project_history which caused foreign key constraint violation
    
  2. Impact
    - Fixes error when changing marketing project status
    - Marketing project changes now tracked in separate table
*/

CREATE OR REPLACE FUNCTION track_marketing_project_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  field_name text;
  old_val text;
  new_val text;
  current_user_id uuid;
BEGIN
  -- Get current user ID, will be NULL for system/automated changes
  current_user_id := auth.uid();

  -- Track status_id changes with readable status names
  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    field_name := 'status';

    -- Get the readable status names instead of IDs
    SELECT name INTO old_val FROM statuses WHERE id = OLD.status_id;
    SELECT name INTO new_val FROM statuses WHERE id = NEW.status_id;

    INSERT INTO marketing_project_history (
      marketing_project_id,
      user_id,
      field_name,
      old_value,
      new_value,
      changed_at
    ) VALUES (
      NEW.id,
      current_user_id,
      field_name,
      old_val,
      new_val,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;
