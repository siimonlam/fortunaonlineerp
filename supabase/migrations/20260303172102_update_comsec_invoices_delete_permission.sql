/*
  # Update Com Sec Invoice Delete Permissions

  1. Changes
    - Update DELETE policy for comsec_invoices table
    - Allow users with Com Sec project type permissions to delete invoices
    - Keeps admin access as well

  2. Security
    - Users with Com Sec permissions can delete invoices
    - Admins can delete invoices
*/

-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Admins can delete invoices" ON comsec_invoices;

-- Create new delete policy that allows both admins and Com Sec users
CREATE POLICY "Users with Com Sec permissions can delete invoices"
  ON comsec_invoices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_types pt
      JOIN project_type_permissions ptp ON pt.id = ptp.project_type_id
      WHERE pt.name = 'Com Sec'
      AND ptp.user_id = auth.uid()
    )
  );
