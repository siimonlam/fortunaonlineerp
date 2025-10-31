/*
  # Update Project RLS with New Permission System

  1. Changes
    - Drop existing project policies
    - Create new policies using permission functions
    - Admins have full access
    - Users can view/edit projects based on:
      a. Status permissions (view/edit all in status)
      b. Project assignments (view/edit specific projects)
      c. Creator or sales person (automatic access)
    - Only admins can delete projects
  
  2. Security
    - Uses helper functions can_user_view_project() and can_user_edit_project()
    - Prevents users from deleting any projects
*/

-- Drop all existing project policies
DROP POLICY IF EXISTS "Users can view projects" ON projects;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
DROP POLICY IF EXISTS "Allow users to insert own projects" ON projects;
DROP POLICY IF EXISTS "Allow staff to view projects they created" ON projects;
DROP POLICY IF EXISTS "Allow staff to view projects they're assigned to" ON projects;
DROP POLICY IF EXISTS "Allow staff to update projects they created" ON projects;
DROP POLICY IF EXISTS "Allow staff to update projects they're assigned to" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can view permitted projects" ON projects;
DROP POLICY IF EXISTS "Users can update permitted projects" ON projects;
DROP POLICY IF EXISTS "Only admins can delete projects" ON projects;

-- SELECT Policy: Users can view projects they have permission for
CREATE POLICY "Users can view permitted projects"
  ON projects FOR SELECT
  TO authenticated
  USING (can_user_view_project(id, auth.uid()));

-- INSERT Policy: Authenticated users can create projects
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- UPDATE Policy: Users can update projects they have edit permission for
CREATE POLICY "Users can update permitted projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (can_user_edit_project(id, auth.uid()))
  WITH CHECK (can_user_edit_project(id, auth.uid()));

-- DELETE Policy: Only admins can delete projects
CREATE POLICY "Only admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );
