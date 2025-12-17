/*
  # Add Marketing Project Status History Tracking

  1. Changes
    - Create trigger function for marketing_projects to track status changes
    - Use the same project_history table with readable status names
    - Ensure both funding and marketing projects use human-readable status logs

  2. Purpose
    - Track status changes for marketing projects like funding projects
    - Make history logs consistent and readable across all project types
*/

-- Create trigger function for marketing projects (similar to regular projects)
CREATE OR REPLACE FUNCTION track_marketing_project_changes()
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
      current_user_id,
      field_name,
      old_val,
      new_val,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on marketing_projects
DROP TRIGGER IF EXISTS track_marketing_project_changes_trigger ON marketing_projects;

CREATE TRIGGER track_marketing_project_changes_trigger
  AFTER UPDATE ON marketing_projects
  FOR EACH ROW
  EXECUTE FUNCTION track_marketing_project_changes();