/*
  # Fix infinite recursion in project view policies

  1. Changes
    - Simplify view policy to avoid recursion
    - Remove staff email lookup that could cause circular references
    - Keep direct relationships only

  2. Security
    - Users can view projects they created
    - Users can view projects they're assigned to via project_staff
    - Users can view projects where they're assigned to tasks
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view projects they have access to" ON projects;

-- Create simplified policy without recursion
CREATE POLICY "Users can view projects they have access to"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    -- User created the project
    auth.uid() = created_by
    OR
    -- User is assigned to the project via project_staff
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = projects.id 
      AND project_staff.staff_id = auth.uid()
    )
    OR
    -- User is assigned to any task in the project
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.project_id = projects.id
      AND tasks.assigned_to = auth.uid()
    )
  );

-- Drop and recreate update policy
DROP POLICY IF EXISTS "Users can update projects they have access to" ON projects;

CREATE POLICY "Users can update projects they have access to"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = projects.id 
      AND project_staff.staff_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    OR
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = projects.id 
      AND project_staff.staff_id = auth.uid()
    )
  );
