/*
  # Update marketing_projects RLS to include marketing_project_staff

  1. Changes
    - Update SELECT policy to include staff with view permissions
    - Update UPDATE policy to include staff with edit permissions
    - Maintains existing access for creators, sales persons, and admins
*/

-- Drop existing policies
DROP POLICY IF EXISTS "All authenticated users can view marketing projects" ON marketing_projects;
DROP POLICY IF EXISTS "Authorized users can update marketing projects" ON marketing_projects;

-- Recreate SELECT policy with marketing_project_staff access
CREATE POLICY "Users can view marketing projects with access"
  ON marketing_projects
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = sales_person_id
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM marketing_project_staff
      WHERE marketing_project_staff.project_id = marketing_projects.id
      AND marketing_project_staff.user_id = auth.uid()
      AND marketing_project_staff.can_view = true
    )
  );

-- Recreate UPDATE policy with marketing_project_staff edit access
CREATE POLICY "Authorized users can update marketing projects"
  ON marketing_projects
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = sales_person_id
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM marketing_project_staff
      WHERE marketing_project_staff.project_id = marketing_projects.id
      AND marketing_project_staff.user_id = auth.uid()
      AND marketing_project_staff.can_edit = true
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    OR auth.uid() = sales_person_id
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM marketing_project_staff
      WHERE marketing_project_staff.project_id = marketing_projects.id
      AND marketing_project_staff.user_id = auth.uid()
      AND marketing_project_staff.can_edit = true
    )
  );
