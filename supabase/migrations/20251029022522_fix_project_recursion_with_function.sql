/*
  # Fix project/project_staff recursion with security definer function

  1. Problem
    - projects SELECT checks project_staff table
    - project_staff SELECT checks projects table
    - Creates infinite recursion loop

  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS to check project ownership
    - Use this function in project_staff policies
    - Keep the one-way reference from projects to project_staff
    
  3. Security
    - Function only returns true/false, no data exposure
    - Function checks if user created the project
    - Maintains security while breaking recursion
*/

-- Create a function that checks if user owns a project (bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_creator(project_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_uuid
    AND created_by = user_uuid
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "View staff for own projects" ON project_staff;

-- Create new non-recursive policies for project_staff SELECT
CREATE POLICY "Staff can view their own assignments"
  ON project_staff
  FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid());

CREATE POLICY "Creators can view all staff on their projects"
  ON project_staff
  FOR SELECT
  TO authenticated
  USING (is_project_creator(project_id, auth.uid()));

-- Update INSERT policy to use the function too
DROP POLICY IF EXISTS "Project creators can assign staff" ON project_staff;

CREATE POLICY "Project creators can assign staff"
  ON project_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (is_project_creator(project_id, auth.uid()));

-- Update DELETE policy to use the function too
DROP POLICY IF EXISTS "Project creators can remove staff" ON project_staff;

CREATE POLICY "Project creators can remove staff"
  ON project_staff
  FOR DELETE
  TO authenticated
  USING (is_project_creator(project_id, auth.uid()));
