/*
  # Fix project_staff RLS policies

  1. Changes
    - Drop existing policies that cause infinite recursion
    - Create simpler, non-recursive policies
    - Staff can view assignments for projects they're assigned to
    - Project creators can manage staff assignments

  2. Security
    - Prevents infinite recursion in SELECT policy
    - Maintains proper access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view project assignments for their projects" ON project_staff;
DROP POLICY IF EXISTS "Project creators can assign staff" ON project_staff;
DROP POLICY IF EXISTS "Project creators can remove staff" ON project_staff;

-- Allow staff to view assignments for projects they're on
CREATE POLICY "Staff can view their assignments"
  ON project_staff
  FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid());

-- Allow viewing all assignments if user is the project creator
CREATE POLICY "Project creators can view all assignments"
  ON project_staff
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_staff.project_id
      AND projects.created_by = auth.uid()
    )
  );

-- Allow project creators to assign staff
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

-- Allow project creators to remove staff
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
