/*
  # Fix Projects RLS Infinite Recursion
  
  1. Problem
    - Direct EXISTS check on staff table in RLS policy causes infinite recursion
    - This happens when staff table queries reference projects
    
  2. Solution
    - Create SECURITY DEFINER functions to check admin status and permissions
    - These functions bypass RLS and prevent recursion
    - Update policies to use these functions
    
  3. Security
    - Functions use SECURITY DEFINER to bypass RLS safely
    - Still maintain proper access control
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS is_admin(uuid);
DROP FUNCTION IF EXISTS has_status_permission(uuid, uuid, text);

-- Function to check if user is admin (bypasses RLS)
CREATE FUNCTION is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff 
    WHERE id = check_user_id 
    AND role = 'admin'
  );
END;
$$;

-- Function to check if user has status permission (bypasses RLS)
CREATE FUNCTION has_status_permission(check_user_id uuid, check_status_id uuid, permission_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF permission_type = 'view' THEN
    RETURN EXISTS (
      SELECT 1 FROM status_permissions
      WHERE user_id = check_user_id
      AND status_id = check_status_id
      AND can_view_all = true
    );
  ELSIF permission_type = 'edit' THEN
    RETURN EXISTS (
      SELECT 1 FROM status_permissions
      WHERE user_id = check_user_id
      AND status_id = check_status_id
      AND can_edit_all = true
    );
  END IF;
  
  RETURN false;
END;
$$;

-- Drop old policies
DROP POLICY IF EXISTS "Staff can view all projects via status permissions" ON projects;
DROP POLICY IF EXISTS "Staff can update projects via status permissions" ON projects;

-- Create new optimized SELECT policy with SECURITY DEFINER functions
CREATE POLICY "Staff can view projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR
    auth.uid() = created_by
    OR
    auth.uid() = sales_person_id
    OR
    has_status_permission(auth.uid(), status_id, 'view')
    OR
    EXISTS (
      SELECT 1 FROM project_permissions pp
      WHERE pp.project_id = projects.id
      AND pp.user_id = auth.uid()
      AND pp.can_view = true
    )
  );

-- Create new optimized UPDATE policy with SECURITY DEFINER functions
CREATE POLICY "Staff can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR
    auth.uid() = created_by
    OR
    auth.uid() = sales_person_id
    OR
    has_status_permission(auth.uid(), status_id, 'edit')
    OR
    EXISTS (
      SELECT 1 FROM project_permissions pp
      WHERE pp.project_id = projects.id
      AND pp.user_id = auth.uid()
      AND pp.can_edit = true
    )
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR
    auth.uid() = created_by
    OR
    auth.uid() = sales_person_id
    OR
    has_status_permission(auth.uid(), status_id, 'edit')
    OR
    EXISTS (
      SELECT 1 FROM project_permissions pp
      WHERE pp.project_id = projects.id
      AND pp.user_id = auth.uid()
      AND pp.can_edit = true
    )
  );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_status_permission(uuid, uuid, text) TO authenticated;
