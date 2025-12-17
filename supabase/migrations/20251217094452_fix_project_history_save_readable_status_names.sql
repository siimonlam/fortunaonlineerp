/*
  # Fix Project History to Save Readable Status Names

  1. Changes
    - Update track_project_changes function to save status names instead of IDs
    - Change field_name from 'status_id' to 'status' for better readability
    - Join with statuses table to get readable names like "Hi-Po", "Mi-Po", etc.

  2. Purpose
    - Make history logs human-readable without requiring lookups
    - Improve user experience when viewing change history
*/

CREATE OR REPLACE FUNCTION track_project_changes()
RETURNS TRIGGER AS $$
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

    INSERT INTO project_history (
      project_id,
      user_id,
      field_name,
      old_value,
      new_value,
      changed_at
    ) VALUES (
      NEW.id,
      current_user_id,  -- Can be NULL for automated changes
      field_name,
      old_val,
      new_val,
      now()
    );
  END IF;

  -- Track other important fields as needed in the future

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;