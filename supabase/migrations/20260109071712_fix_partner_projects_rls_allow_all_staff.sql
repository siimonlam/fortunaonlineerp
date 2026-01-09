/*
  # Fix Partner Projects RLS - Allow All Staff to Create

  1. Changes
    - Update INSERT policy for partner_projects
    - Allow all authenticated users to create partner projects (not just admins)
    - This enables staff to create partner project reports for commission tracking
    
  2. Security
    - All authenticated users can view, insert, update, and delete partner projects
    - This aligns with the general access pattern where staff can manage project-related data
*/

-- Drop the existing admin-only insert policy
DROP POLICY IF EXISTS "Admins can insert partner projects" ON partner_projects;

-- Create new policy allowing all authenticated users to insert
CREATE POLICY "Authenticated users can insert partner projects"
  ON partner_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Drop and recreate update policy to allow all authenticated users
DROP POLICY IF EXISTS "Admins can update partner projects" ON partner_projects;

CREATE POLICY "Authenticated users can update partner projects"
  ON partner_projects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop and recreate delete policy to allow all authenticated users
DROP POLICY IF EXISTS "Admins can delete partner projects" ON partner_projects;

CREATE POLICY "Authenticated users can delete partner projects"
  ON partner_projects
  FOR DELETE
  TO authenticated
  USING (true);