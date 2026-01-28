/*
  # Add Project Not Started Flag to Projects

  1. Changes
    - Add `project_not_started` boolean column to `projects` table
      - Default value: `true` (new projects are not started by default)
      - When `kickoff_date` is set, this should be automatically set to false
  
  2. Notes
    - This flag is used to track projects that haven't officially started yet
    - Projects with this flag will show a "Project Not Started" label in the dashboard
    - The flag is automatically unchecked when kickoff_date is set
*/

-- Add project_not_started column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_not_started boolean DEFAULT true;

-- Create a trigger to automatically set project_not_started to false when kickoff_date is set
CREATE OR REPLACE FUNCTION auto_uncheck_project_not_started()
RETURNS TRIGGER AS $$
BEGIN
  -- If kickoff_date is being set (from null to a value), uncheck project_not_started
  IF NEW.kickoff_date IS NOT NULL AND (OLD.kickoff_date IS NULL OR OLD.kickoff_date IS DISTINCT FROM NEW.kickoff_date) THEN
    NEW.project_not_started = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create it
DROP TRIGGER IF EXISTS trigger_auto_uncheck_project_not_started ON projects;

CREATE TRIGGER trigger_auto_uncheck_project_not_started
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_uncheck_project_not_started();
