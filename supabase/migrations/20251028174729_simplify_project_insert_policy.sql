/*
  # Simplify project INSERT policy to prevent recursion

  1. Changes
    - Simplify INSERT policy to only check created_by matches auth.uid()
    - Remove any complex joins that could cause recursion during INSERT

  2. Security
    - Users can only create projects where they are the creator
*/

-- Drop and recreate the INSERT policy with no subqueries
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;

CREATE POLICY "Authenticated users can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Also simplify the SELECT policy to avoid checking tasks during INSERT
DROP POLICY IF EXISTS "Users can view projects they have access to" ON projects;

CREATE POLICY "Users can view projects they have access to"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = projects.id 
      AND project_staff.staff_id = auth.uid()
    )
  );
