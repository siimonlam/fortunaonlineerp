/*
  # Fix infinite recursion in RLS policies

  1. Changes
    - Simplify project policies to avoid circular references
    - Use direct table lookups instead of subqueries that reference the same table
    - Maintain security while avoiding recursion

  2. Security
    - Users can still only access projects they're assigned to
    - All operations properly authenticated
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Assigned users can view projects" ON projects;
DROP POLICY IF EXISTS "Assigned users can update projects" ON projects;

-- Create simplified policies without recursion
CREATE POLICY "Assigned users can view projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = id 
      AND project_staff.staff_id = auth.uid()
    )
  );

CREATE POLICY "Assigned users can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = id 
      AND project_staff.staff_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = id 
      AND project_staff.staff_id = auth.uid()
    )
  );
