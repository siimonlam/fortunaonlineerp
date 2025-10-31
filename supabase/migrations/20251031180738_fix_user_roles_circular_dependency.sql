/*
  # Fix Circular Dependency in User Roles RLS

  1. Problem
    - The "Admins can manage all roles" policy uses is_admin() function
    - The is_admin() function queries user_roles table
    - This creates a circular dependency that blocks all queries
    
  2. Solution
    - Remove the circular policy
    - Allow admins to manage roles using a direct check that won't cause recursion
    - Keep the simple SELECT policy for all users
    
  3. Security
    - All authenticated users can view all roles (needed for RLS checks in other tables)
    - Only existing admins can modify role assignments
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;

-- Create separate policies for INSERT, UPDATE, DELETE
-- These check user_roles directly without using the is_admin function

CREATE POLICY "Admins can insert roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can update roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );
