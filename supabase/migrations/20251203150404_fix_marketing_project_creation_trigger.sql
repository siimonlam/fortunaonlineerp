/*
  # Fix marketing project creation trigger

  1. Changes
    - Drop the incorrect trigger that tries to insert into project_staff
    - Create a new trigger function for marketing_project_staff
    - The old trigger was causing infinite recursion by referencing the wrong table
*/

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS assign_creator_trigger_marketing ON marketing_projects;

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS assign_creator_to_marketing_project() CASCADE;

-- Create new function for marketing projects
CREATE OR REPLACE FUNCTION assign_creator_to_marketing_project()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert creator into marketing_project_staff table
  INSERT INTO marketing_project_staff (project_id, user_id, can_view, can_edit)
  VALUES (NEW.id, NEW.created_by, true, true)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create the new trigger
CREATE TRIGGER assign_creator_trigger_marketing
  AFTER INSERT ON marketing_projects
  FOR EACH ROW
  EXECUTE FUNCTION assign_creator_to_marketing_project();
