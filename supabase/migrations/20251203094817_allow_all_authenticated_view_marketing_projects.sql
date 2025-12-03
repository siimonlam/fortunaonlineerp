/*
  # Allow All Authenticated Users to View Marketing Projects

  1. Purpose
    - Update marketing_projects RLS to match the simplified behavior of regular projects
    - All authenticated users can view all marketing projects
    - This aligns with the existing policy on the projects table

  2. Changes
    - Replace restrictive SELECT policy with one that allows all authenticated users
    - Keep UPDATE and DELETE policies as they are (require specific permissions)

  3. Security
    - View access: All authenticated users
    - Edit access: Creator, sales person, assigned staff with edit permission, or admin
    - Delete access: Creator or admin only
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Authorized users can view marketing projects" ON marketing_projects;

-- Allow all authenticated users to view marketing projects
CREATE POLICY "All authenticated users can view marketing projects"
  ON marketing_projects FOR SELECT
  TO authenticated
  USING (true);
