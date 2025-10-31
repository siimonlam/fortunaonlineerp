/*
  # Update Project Permission Functions with CASCADE

  1. Changes
    - Drop and recreate `can_user_view_project` function with CASCADE to update dependent policies
    - Drop and recreate `can_user_edit_project` function with CASCADE to update dependent policies
    - Update functions to check `project_permissions` table for custom user access
    
  2. Security
    - Maintains existing admin, creator, and sales person checks
    - Adds check for project_permissions table for custom user access
    - Keeps status-level permissions checks
*/

-- Drop and recreate can_user_view_project function with CASCADE
DROP FUNCTION IF EXISTS can_user_view_project(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION can_user_view_project(project_uuid uuid, staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_is_creator boolean;
  v_is_sales_person boolean;
  v_has_project_access boolean;
  v_has_status_access boolean;
  v_project_status_id uuid;
BEGIN
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM staff
  WHERE id = staff_id;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- Check if user is creator
  SELECT created_by = staff_id INTO v_is_creator
  FROM projects
  WHERE id = project_uuid;

  IF v_is_creator THEN
    RETURN true;
  END IF;

  -- Check if user is sales person
  SELECT sales_person_id = staff_id INTO v_is_sales_person
  FROM projects
  WHERE id = project_uuid;

  IF v_is_sales_person THEN
    RETURN true;
  END IF;

  -- Check project_permissions table for custom access
  SELECT can_view INTO v_has_project_access
  FROM project_permissions
  WHERE project_id = project_uuid
  AND user_id = staff_id;

  IF v_has_project_access THEN
    RETURN true;
  END IF;

  -- Check project-specific assignment (legacy support)
  SELECT can_view INTO v_has_project_access
  FROM project_assignments
  WHERE project_id = project_uuid
  AND user_id = staff_id;

  IF v_has_project_access THEN
    RETURN true;
  END IF;

  -- Check status-level permissions
  SELECT p.status_id INTO v_project_status_id
  FROM projects p
  WHERE p.id = project_uuid;

  -- Check if user has view permission for this status or its parent
  SELECT EXISTS (
    SELECT 1 FROM status_permissions sp
    WHERE sp.user_id = staff_id
    AND sp.can_view_all = true
    AND (
      sp.status_id = v_project_status_id
      OR sp.status_id IN (
        SELECT parent_status_id FROM statuses WHERE id = v_project_status_id
      )
    )
  ) INTO v_has_status_access;

  RETURN v_has_status_access;
END;
$$;

-- Drop and recreate can_user_edit_project function with CASCADE
DROP FUNCTION IF EXISTS can_user_edit_project(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION can_user_edit_project(project_uuid uuid, staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_is_creator boolean;
  v_is_sales_person boolean;
  v_has_project_access boolean;
  v_has_status_access boolean;
  v_project_status_id uuid;
BEGIN
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM staff
  WHERE id = staff_id;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- Check if user is creator
  SELECT created_by = staff_id INTO v_is_creator
  FROM projects
  WHERE id = project_uuid;

  IF v_is_creator THEN
    RETURN true;
  END IF;

  -- Check if user is sales person
  SELECT sales_person_id = staff_id INTO v_is_sales_person
  FROM projects
  WHERE id = project_uuid;

  IF v_is_sales_person THEN
    RETURN true;
  END IF;

  -- Check project_permissions table for custom access
  SELECT can_edit INTO v_has_project_access
  FROM project_permissions
  WHERE project_id = project_uuid
  AND user_id = staff_id;

  IF v_has_project_access THEN
    RETURN true;
  END IF;

  -- Check project-specific assignment (legacy support)
  SELECT can_edit INTO v_has_project_access
  FROM project_assignments
  WHERE project_id = project_uuid
  AND user_id = staff_id;

  IF v_has_project_access THEN
    RETURN true;
  END IF;

  -- Check status-level permissions
  SELECT p.status_id INTO v_project_status_id
  FROM projects p
  WHERE p.id = project_uuid;

  -- Check if user has edit permission for this status or its parent
  SELECT EXISTS (
    SELECT 1 FROM status_permissions sp
    WHERE sp.user_id = staff_id
    AND sp.can_edit_all = true
    AND (
      sp.status_id = v_project_status_id
      OR sp.status_id IN (
        SELECT parent_status_id FROM statuses WHERE id = v_project_status_id
      )
    )
  ) INTO v_has_status_access;

  RETURN v_has_status_access;
END;
$$;

-- Recreate the policies that were dropped with CASCADE
CREATE POLICY "Users can view permitted projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (can_user_view_project(id, auth.uid()));

CREATE POLICY "Users can update permitted projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (can_user_edit_project(id, auth.uid()))
  WITH CHECK (can_user_edit_project(id, auth.uid()));
