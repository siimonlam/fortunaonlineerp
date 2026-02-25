/*
  # Make marketing_project_id nullable for global resources

  1. Changes
    - Make `marketing_project_id` nullable in `marketing_share_resources` table
    - This allows resources to be shared globally across all marketing projects
    - Resources with NULL project_id are visible to all marketing users
  
  2. Security
    - Update RLS policies to allow viewing/managing global resources
    - Global resources (NULL project_id) are accessible to all authenticated users
*/

-- Make marketing_project_id nullable
ALTER TABLE marketing_share_resources
ALTER COLUMN marketing_project_id DROP NOT NULL;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view resources for marketing projects they have access to" ON marketing_share_resources;
DROP POLICY IF EXISTS "Marketing project staff can create resources" ON marketing_share_resources;
DROP POLICY IF EXISTS "Marketing project staff can update resources" ON marketing_share_resources;
DROP POLICY IF EXISTS "Marketing project staff can delete resources" ON marketing_share_resources;

-- Create new RLS policies that handle both project-specific and global resources
CREATE POLICY "Users can view marketing resources"
  ON marketing_share_resources
  FOR SELECT
  TO authenticated
  USING (
    -- Global resources (NULL project_id) are visible to all
    marketing_project_id IS NULL
    OR
    -- Project-specific resources are visible to project staff
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Authenticated users can create marketing resources"
  ON marketing_share_resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow creating global resources
    marketing_project_id IS NULL
    OR
    -- Allow creating project-specific resources if user has access
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update marketing resources they have access to"
  ON marketing_share_resources
  FOR UPDATE
  TO authenticated
  USING (
    -- Global resources can be updated by anyone
    marketing_project_id IS NULL
    OR
    -- Project-specific resources can be updated by project staff
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    -- Maintain same access rules on update
    marketing_project_id IS NULL
    OR
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete marketing resources they have access to"
  ON marketing_share_resources
  FOR DELETE
  TO authenticated
  USING (
    -- Global resources can be deleted by anyone
    marketing_project_id IS NULL
    OR
    -- Project-specific resources can be deleted by project staff
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );