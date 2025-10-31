/*
  # Fix User Roles RLS for Admin Checks

  1. Changes
    - Allow all authenticated users to check if ANY user is an admin
    - This is necessary for RLS policies in other tables to verify admin status
    - Only reading role information, not sensitive data
    
  2. Security
    - Users can read all roles (needed for RLS policy checks)
    - Only admins can modify roles
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

-- Allow all authenticated users to read user roles
-- This is needed for RLS policies that check admin status
CREATE POLICY "All users can view all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);
