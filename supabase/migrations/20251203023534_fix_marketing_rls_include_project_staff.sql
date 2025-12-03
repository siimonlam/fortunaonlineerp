/*
  # Fix Marketing Project RLS to Include Project Staff

  1. Purpose
    - Update marketing projects RLS to include users assigned via project_staff
    - Marketing projects should be visible to:
      - The creator (created_by)
      - The sales person (sales_person_id)
      - Staff explicitly assigned via project_staff with can_view = true
      - Admins

  2. Changes
    - Update SELECT policy to check project_staff table
    - Update UPDATE policy to check project_staff table with can_edit = true
    - Keep DELETE restricted to creator and admin only

  3. Security
    - Maintains strict access control
    - Allows flexible team collaboration via project_staff assignments
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Creators, sales person, and admins can view marketing projects" ON marketing_projects;
DROP POLICY IF EXISTS "Creators, sales person, and admins can update marketing projects" ON marketing_projects;

-- SELECT: Creator, sales person, assigned staff, or admin can view
CREATE POLICY "Authorized users can view marketing projects"
  ON marketing_projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = sales_person_id
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = marketing_projects.id
      AND project_staff.user_id = auth.uid()
      AND project_staff.can_view = true
    )
  );

-- UPDATE: Creator, sales person, assigned staff with edit permission, or admin can update
CREATE POLICY "Authorized users can update marketing projects"
  ON marketing_projects FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = sales_person_id
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = marketing_projects.id
      AND project_staff.user_id = auth.uid()
      AND project_staff.can_edit = true
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    OR auth.uid() = sales_person_id
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = marketing_projects.id
      AND project_staff.user_id = auth.uid()
      AND project_staff.can_edit = true
    )
  );
