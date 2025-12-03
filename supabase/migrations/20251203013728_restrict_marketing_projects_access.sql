/*
  # Restrict Marketing Projects Access

  1. Purpose
    - Only project creator, sales person, and admins can view/edit marketing projects
    - Replace the permissive RLS policies with restrictive ones

  2. Changes
    - Drop existing permissive policies
    - Create new policies that check:
      - User is the creator (created_by = auth.uid())
      - User is the sales person (sales_person_id = auth.uid())
      - User is an admin (role = 'admin' in user_roles)

  3. Security
    - Marketing projects are now private by default
    - Only authorized users can access them
*/

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all authenticated users to view marketing projects" ON marketing_projects;
DROP POLICY IF EXISTS "Allow all authenticated users to create marketing projects" ON marketing_projects;
DROP POLICY IF EXISTS "Allow all authenticated users to update marketing projects" ON marketing_projects;
DROP POLICY IF EXISTS "Allow all authenticated users to delete marketing projects" ON marketing_projects;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = $1
    AND user_roles.role = 'admin'
  );
$$;

-- SELECT: Creator, sales person, or admin can view
CREATE POLICY "Creators, sales person, and admins can view marketing projects"
  ON marketing_projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = sales_person_id
    OR is_admin(auth.uid())
  );

-- INSERT: Any authenticated user can create (creator will be set to auth.uid())
CREATE POLICY "Authenticated users can create marketing projects"
  ON marketing_projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- UPDATE: Creator, sales person, or admin can update
CREATE POLICY "Creators, sales person, and admins can update marketing projects"
  ON marketing_projects FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = sales_person_id
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() = created_by
    OR auth.uid() = sales_person_id
    OR is_admin(auth.uid())
  );

-- DELETE: Only creator or admin can delete
CREATE POLICY "Creators and admins can delete marketing projects"
  ON marketing_projects FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR is_admin(auth.uid())
  );
