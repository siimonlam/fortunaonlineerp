/*
  # Add Com Sec Project Type and Project Type Permissions

  1. New Project Type
    - Add "Com Sec" project type
    
  2. New Tables
    - `project_type_permissions`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Foreign key to staff
      - `project_type_id` (uuid) - Foreign key to project_types
      - `created_at` (timestamptz)
      
  3. Purpose
    - Control which users can see which project type buttons
    - Users with permission for a project type can see that type's button
    
  4. Security
    - Enable RLS on project_type_permissions
    - Admin users can manage permissions
    - All users can view their own permissions
*/

-- Add Com Sec project type if not exists
INSERT INTO project_types (name)
SELECT 'Com Sec'
WHERE NOT EXISTS (
  SELECT 1 FROM project_types WHERE name = 'Com Sec'
);

-- Create project_type_permissions table
CREATE TABLE IF NOT EXISTS project_type_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  project_type_id uuid NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, project_type_id)
);

-- Enable RLS
ALTER TABLE project_type_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can view all permissions
CREATE POLICY "Admins can view all project type permissions"
  ON project_type_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can view their own permissions
CREATE POLICY "Users can view own project type permissions"
  ON project_type_permissions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Admins can insert permissions
CREATE POLICY "Admins can insert project type permissions"
  ON project_type_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admins can delete permissions
CREATE POLICY "Admins can delete project type permissions"
  ON project_type_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_type_permissions_user_id 
  ON project_type_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_project_type_permissions_project_type_id 
  ON project_type_permissions(project_type_id);