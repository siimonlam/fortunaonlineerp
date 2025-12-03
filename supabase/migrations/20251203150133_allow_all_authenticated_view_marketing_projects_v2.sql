/*
  # Allow all authenticated users to view marketing projects

  1. Changes
    - Drop existing restrictive SELECT policy
    - Create new policy allowing all authenticated users to view marketing projects
    - This matches the access pattern used for regular projects
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view marketing projects with access" ON marketing_projects;

-- Allow all authenticated users to view marketing projects
CREATE POLICY "All authenticated users can view marketing projects"
  ON marketing_projects
  FOR SELECT
  TO authenticated
  USING (true);
