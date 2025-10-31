/*
  # Fix User Roles RLS with Security Definer Function

  1. Problem
    - Cannot check admin status from user_roles RLS without circular dependency
    
  2. Solution
    - Create a security definer function that bypasses RLS
    - Use this function in the user_roles modification policies
    
  3. Security
    - All authenticated users can view all roles (needed for other table RLS)
    - Only admins can modify roles (checked via security definer function)
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

-- Create a security definer function that bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION check_is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = check_user_id AND role = 'admin'
  );
END;
$$;

-- Now use the security definer function in policies
CREATE POLICY "Admins can insert roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (check_is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (check_is_admin(auth.uid()))
  WITH CHECK (check_is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (check_is_admin(auth.uid()));
