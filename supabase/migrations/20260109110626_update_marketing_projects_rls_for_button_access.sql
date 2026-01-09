/*
  # Update Marketing Projects RLS for Button Access

  1. Changes
    - Update SELECT policy to include users with button access
    - Update UPDATE policy to include users with button access
    - Users with button permissions (G-NiiB, Fortuna, HKFUND, etc.) can now view and edit projects

  2. Security
    - Users can access projects if:
      a) They created the project, OR
      b) They are the sales person, OR
      c) They are an admin, OR
      d) They have project staff access, OR
      e) They have button access to the project

  3. Notes
    - Maintains all existing access controls
    - Adds button access as an additional permission path
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view marketing projects with access" ON marketing_projects;
DROP POLICY IF EXISTS "Authorized users can update marketing projects" ON marketing_projects;

-- Recreate SELECT policy with button access
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
    OR EXISTS (
      SELECT 1 FROM marketing_project_buttons mpb
      INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
      WHERE mpb.marketing_project_id = marketing_projects.id
      AND mbs.user_id = auth.uid()
    )
    OR NOT EXISTS (
      SELECT 1 FROM marketing_project_buttons mpb
      INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
      WHERE mpb.marketing_project_id = marketing_projects.id
    )
  );

-- Recreate UPDATE policy with button access
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
    OR EXISTS (
      SELECT 1 FROM marketing_project_buttons mpb
      INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
      WHERE mpb.marketing_project_id = marketing_projects.id
      AND mbs.user_id = auth.uid()
    )
    OR NOT EXISTS (
      SELECT 1 FROM marketing_project_buttons mpb
      INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
      WHERE mpb.marketing_project_id = marketing_projects.id
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
    OR EXISTS (
      SELECT 1 FROM marketing_project_buttons mpb
      INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
      WHERE mpb.marketing_project_id = marketing_projects.id
      AND mbs.user_id = auth.uid()
    )
    OR NOT EXISTS (
      SELECT 1 FROM marketing_project_buttons mpb
      INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
      WHERE mpb.marketing_project_id = marketing_projects.id
    )
  );