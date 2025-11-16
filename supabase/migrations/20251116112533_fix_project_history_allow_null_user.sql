/*
  # Fix project history to allow NULL user_id for automated changes

  1. Changes
    - Make user_id nullable in project_history table
    - Update history tracking trigger to handle NULL user_id (for system/automation changes)

  2. Notes
    - Automated changes (like automation rules) won't have a user_id
    - Manual changes will still track the user_id
*/

-- Make user_id nullable
ALTER TABLE project_history 
  ALTER COLUMN user_id DROP NOT NULL;

-- Update the tracking function to handle NULL user_id gracefully
CREATE OR REPLACE FUNCTION track_project_changes()
RETURNS TRIGGER
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

  -- Track status_id changes
  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    field_name := 'status_id';
    old_val := OLD.status_id::text;
    new_val := NEW.status_id::text;
    
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

  -- Track other important fields...
  -- (Add more field tracking as needed)

  RETURN NEW;
END;
$$;
