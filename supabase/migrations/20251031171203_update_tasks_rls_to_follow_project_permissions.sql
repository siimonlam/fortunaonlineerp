/*
  # Update Tasks RLS to Follow Project Permissions

  1. Changes
    - Drop old tasks RLS policies that use deprecated project_staff table
    - Create new tasks RLS policies that use project_permissions system
    - Tasks inherit view/edit permissions from the project
    - Task assignment (assigned_to) is for tracking only, not permissions
    
  2. Security
    - Users with can_view on project can view tasks
    - Users with can_edit on project can create/update/delete tasks
    - Admins have full access to all tasks
    - Project creators have full access to their project tasks

  3. Notes
    - Task assignment is just for tracking responsibility
    - Permissions come from the project, not the assigned user
*/

-- Drop old RLS policies
DROP POLICY IF EXISTS "Assigned users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Assigned users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Assigned users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Assigned users can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Staff can view tasks for assigned projects" ON tasks;
DROP POLICY IF EXISTS "Staff can create tasks for assigned projects" ON tasks;
DROP POLICY IF EXISTS "Staff can update tasks for assigned projects" ON tasks;
DROP POLICY IF EXISTS "Staff can delete tasks for assigned projects" ON tasks;

-- Create new RLS policies that follow project permissions

-- View policy: Users who can view the project can view its tasks
CREATE POLICY "Users with project view access can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    -- Admin users can view all tasks
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR
    -- Project creator can view tasks
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.created_by = auth.uid()
    )
    OR
    -- Users with view permission can view tasks
    EXISTS (
      SELECT 1 FROM project_permissions
      WHERE project_permissions.project_id = tasks.project_id
      AND project_permissions.user_id = auth.uid()
      AND project_permissions.can_view = true
    )
  );

-- Insert policy: Users who can edit the project can create tasks
CREATE POLICY "Users with project edit access can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin users can create tasks
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR
    -- Project creator can create tasks
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.created_by = auth.uid()
    )
    OR
    -- Users with edit permission can create tasks
    EXISTS (
      SELECT 1 FROM project_permissions
      WHERE project_permissions.project_id = tasks.project_id
      AND project_permissions.user_id = auth.uid()
      AND project_permissions.can_edit = true
    )
  );

-- Update policy: Users who can edit the project can update tasks
CREATE POLICY "Users with project edit access can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    -- Admin users can update tasks
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR
    -- Project creator can update tasks
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.created_by = auth.uid()
    )
    OR
    -- Users with edit permission can update tasks
    EXISTS (
      SELECT 1 FROM project_permissions
      WHERE project_permissions.project_id = tasks.project_id
      AND project_permissions.user_id = auth.uid()
      AND project_permissions.can_edit = true
    )
  )
  WITH CHECK (
    -- Same checks for the updated row
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_permissions
      WHERE project_permissions.project_id = tasks.project_id
      AND project_permissions.user_id = auth.uid()
      AND project_permissions.can_edit = true
    )
  );

-- Delete policy: Users who can edit the project can delete tasks
CREATE POLICY "Users with project edit access can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    -- Admin users can delete tasks
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR
    -- Project creator can delete tasks
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.created_by = auth.uid()
    )
    OR
    -- Users with edit permission can delete tasks
    EXISTS (
      SELECT 1 FROM project_permissions
      WHERE project_permissions.project_id = tasks.project_id
      AND project_permissions.user_id = auth.uid()
      AND project_permissions.can_edit = true
    )
  );
