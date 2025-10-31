/*
  # Fix infinite recursion by dropping and recreating policies

  1. Problem
    - Cannot drop function because policies depend on it
    
  2. Solution
    - Drop policies first, then function
    - Recreate with simpler non-recursive approach
*/

-- Drop all project_staff policies that depend on the function
DROP POLICY IF EXISTS "Staff can view their own assignments" ON project_staff;
DROP POLICY IF EXISTS "Creators can view all staff on their projects" ON project_staff;
DROP POLICY IF EXISTS "Project creators can assign staff" ON project_staff;
DROP POLICY IF EXISTS "Project creators can remove staff" ON project_staff;

-- Now drop the function
DROP FUNCTION IF EXISTS is_project_creator(uuid, uuid);

-- Create a single simple policy for viewing project_staff
-- Only allow users to see entries where they are the staff member
CREATE POLICY "Users can view their staff assignments"
  ON project_staff
  FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid());

-- For INSERT, check project ownership (doesn't cause recursion in INSERT)
CREATE POLICY "Project creators can assign staff"
  ON project_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_staff.project_id
      AND projects.created_by = auth.uid()
    )
  );

-- For DELETE, check project ownership (doesn't cause recursion in DELETE)
CREATE POLICY "Project creators can remove staff"
  ON project_staff
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_staff.project_id
      AND projects.created_by = auth.uid()
    )
  );
