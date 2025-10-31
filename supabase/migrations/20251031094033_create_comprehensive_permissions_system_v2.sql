/*
  # Create Comprehensive Permissions System

  1. User Roles
    - Add `role` column to staff table (admin/user)
    - Add `is_admin` helper column for easier queries
  
  2. New Tables
    - `status_permissions`: Admin authorizes users to view/edit all projects in a main status
    - `project_assignments`: Assign specific users to specific projects with view/edit rights
  
  3. Permission Logic
    - Admins: Full access to everything
    - Users with status permissions: Can view/edit ALL projects in assigned statuses
    - Users assigned to projects: Can view/edit specific assigned projects
    - Sales person & creator: Automatic view/edit access to their projects
    - Delete: Only admins can delete
  
  4. Security
    - Enable RLS on all new tables
    - Create policies for secure access control
*/

-- Add role column to staff table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'role'
  ) THEN
    ALTER TABLE staff ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE staff ADD COLUMN is_admin boolean GENERATED ALWAYS AS (role = 'admin') STORED;
  END IF;
END $$;

-- Create status_permissions table
CREATE TABLE IF NOT EXISTS status_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
  can_view_all boolean DEFAULT false,
  can_edit_all boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, status_id)
);

-- Create project_assignments table (similar to client_access)
CREATE TABLE IF NOT EXISTS project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  assigned_by uuid NOT NULL REFERENCES staff(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE status_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for status_permissions

CREATE POLICY "Admins can manage all status permissions"
  ON status_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own status permissions"
  ON status_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for project_assignments

CREATE POLICY "Admins can manage all project assignments"
  ON project_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own project assignments"
  ON project_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_status_permissions_user_id ON status_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_status_permissions_status_id ON status_permissions(status_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_is_admin ON staff(is_admin);

-- Create helper function to check if user can edit project
CREATE OR REPLACE FUNCTION can_user_edit_project(project_uuid uuid, staff_id uuid)
RETURNS boolean AS $$
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

  -- Check project-specific assignment
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check if user can view project
CREATE OR REPLACE FUNCTION can_user_view_project(project_uuid uuid, staff_id uuid)
RETURNS boolean AS $$
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

  -- Check project-specific assignment
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
