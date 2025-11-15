/*
  # Fix project_labels RLS to allow project editors to manage labels

  1. Changes
    - Update INSERT policy to allow users with edit permissions on the project
    - Update DELETE policy to allow users with edit permissions on the project
    
  2. Security
    - Users can only add/remove labels for projects they have edit access to
    - Admins retain full access
    - View access remains unchanged
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can assign labels to projects" ON project_labels;
DROP POLICY IF EXISTS "Admins can remove labels from projects" ON project_labels;

-- Allow users with edit permissions to add labels
CREATE POLICY "Users with edit access can assign labels to projects"
  ON project_labels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_labels.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM staff
          WHERE staff.id = auth.uid() AND staff.is_admin = true
        )
        OR EXISTS (
          SELECT 1 FROM project_permissions pp
          WHERE pp.project_id = p.id
          AND pp.user_id = auth.uid()
          AND pp.can_edit = true
        )
      )
    )
  );

-- Allow users with edit permissions to remove labels
CREATE POLICY "Users with edit access can remove labels from projects"
  ON project_labels
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_labels.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM staff
          WHERE staff.id = auth.uid() AND staff.is_admin = true
        )
        OR EXISTS (
          SELECT 1 FROM project_permissions pp
          WHERE pp.project_id = p.id
          AND pp.user_id = auth.uid()
          AND pp.can_edit = true
        )
      )
    )
  );
