/*
  # Auto-update Project Title from Company Name and Project Name

  1. New Trigger Function
    - `update_project_title()` - Automatically sets title as "Company Name + Project Name"
    - Runs before INSERT or UPDATE on projects table
    - Only updates title when company_name or project_name changes
  
  2. Changes
    - Creates trigger function to maintain project title
    - Adds trigger to projects table for automatic title generation
*/

-- Create function to auto-update project title
CREATE OR REPLACE FUNCTION update_project_title()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Concatenate company_name and project_name with a space
  -- Handle NULL values gracefully
  NEW.title := TRIM(COALESCE(NEW.company_name, '') || ' ' || COALESCE(NEW.project_name, ''));
  
  -- If title is empty or just whitespace, set to NULL
  IF NEW.title = '' THEN
    NEW.title := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_project_title ON projects;

CREATE TRIGGER trigger_update_project_title
  BEFORE INSERT OR UPDATE OF company_name, project_name
  ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_project_title();
