/*
  # Auto-set start_date for new Funding Projects

  1. Changes
    - Creates a trigger function to automatically set `start_date` to today's date
    - Only applies when creating Funding Projects
    - Only sets the date if `start_date` is NULL
    
  2. Purpose
    - Automatically populate start_date when creating funding projects through the client onboarding flow
    - Ensures all funding projects have a start date from creation
*/

-- Create trigger function to auto-set start_date for funding projects
CREATE OR REPLACE FUNCTION auto_set_funding_project_start_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set start_date if it's NULL and this is a Funding Project
  IF NEW.start_date IS NULL 
     AND NEW.project_type_id = '49c17e80-db14-4e13-b03f-537771270696' THEN
    NEW.start_date := CURRENT_DATE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on projects table
DROP TRIGGER IF EXISTS trigger_auto_set_funding_start_date ON projects;
CREATE TRIGGER trigger_auto_set_funding_start_date
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_funding_project_start_date();
