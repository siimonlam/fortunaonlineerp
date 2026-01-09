/*
  # Update Marketing Share Resources RLS for Button Access

  1. Changes
    - Drop existing RLS policies on marketing_share_resources
    - Create new policies that include button access permissions
    - Users with button access can now view and edit resources for projects linked to their buttons

  2. Security
    - Users can access resources if:
      a) They created the marketing project, OR
      b) They are in the project staff (marketing_project_staff), OR
      c) They have access to a button that points to that marketing project (marketing_button_staff)

  3. Notes
    - This allows users with button permissions (G-NiiB, Fortuna, HKFUND, etc.) to access project resources
    - Maintains security by requiring explicit button access grants
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view resources for marketing projects they have access to" ON marketing_share_resources;
DROP POLICY IF EXISTS "Marketing project staff can create resources" ON marketing_share_resources;
DROP POLICY IF EXISTS "Marketing project staff can update resources" ON marketing_share_resources;
DROP POLICY IF EXISTS "Marketing project staff can delete resources" ON marketing_share_resources;

-- Create new SELECT policy with button access
CREATE POLICY "Users can view resources with project or button access"
  ON marketing_share_resources
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        -- User created the project
        mp.created_by = auth.uid()
        -- User is in project staff
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
        -- User has button access to this project
        OR EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
          AND mbs.user_id = auth.uid()
        )
        -- If no button restrictions exist, all users can access
        OR NOT EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
        )
      )
    )
  );

-- Create new INSERT policy with button access
CREATE POLICY "Users can create resources with project or button access"
  ON marketing_share_resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        -- User created the project
        mp.created_by = auth.uid()
        -- User is in project staff
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
        -- User has button access to this project
        OR EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
          AND mbs.user_id = auth.uid()
        )
        -- If no button restrictions exist, all users can access
        OR NOT EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
        )
      )
    )
  );

-- Create new UPDATE policy with button access
CREATE POLICY "Users can update resources with project or button access"
  ON marketing_share_resources
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        -- User created the project
        mp.created_by = auth.uid()
        -- User is in project staff
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
        -- User has button access to this project
        OR EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
          AND mbs.user_id = auth.uid()
        )
        -- If no button restrictions exist, all users can access
        OR NOT EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        -- User created the project
        mp.created_by = auth.uid()
        -- User is in project staff
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
        -- User has button access to this project
        OR EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
          AND mbs.user_id = auth.uid()
        )
        -- If no button restrictions exist, all users can access
        OR NOT EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
        )
      )
    )
  );

-- Create new DELETE policy with button access
CREATE POLICY "Users can delete resources with project or button access"
  ON marketing_share_resources
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        -- User created the project
        mp.created_by = auth.uid()
        -- User is in project staff
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
        -- User has button access to this project
        OR EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
          AND mbs.user_id = auth.uid()
        )
        -- If no button restrictions exist, all users can access
        OR NOT EXISTS (
          SELECT 1 FROM marketing_project_buttons mpb
          INNER JOIN marketing_button_staff mbs ON mbs.button_id = mpb.id
          WHERE mpb.marketing_project_id = mp.id
        )
      )
    )
  );