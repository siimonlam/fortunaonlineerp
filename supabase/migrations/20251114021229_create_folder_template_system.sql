/*
  # Create Folder Template System

  1. New Tables
    - `folder_templates`
      - Stores the complete folder structure template for BUD projects
      - JSON structure with folders and template files
      - Versioning support for template updates
    
    - `project_folders`
      - Tracks Google Drive folder IDs for each project
      - Links projects to their Google Drive folders
      - Stores creation status and metadata

  2. Security
    - Enable RLS on both tables
    - Only authenticated users can view templates
    - Only admins can modify templates
    - Project folder access follows project permissions
*/

-- Create folder templates table
CREATE TABLE IF NOT EXISTS folder_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  structure jsonb NOT NULL,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create project folders tracking table
CREATE TABLE IF NOT EXISTS project_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  parent_folder_id text NOT NULL,
  folder_structure jsonb NOT NULL,
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE folder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;

-- Folder templates policies
CREATE POLICY "Authenticated users can view folder templates"
  ON folder_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert folder templates"
  ON folder_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update folder templates"
  ON folder_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Project folders policies
CREATE POLICY "Users can view project folders they have access to"
  ON project_folders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_folders.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_staff ps
          WHERE ps.project_id = p.id
          AND ps.staff_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert project folders for projects they can access"
  ON project_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_folders.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_staff ps
          WHERE ps.project_id = p.id
          AND ps.staff_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update project folders for projects they can access"
  ON project_folders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_folders.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_staff ps
          WHERE ps.project_id = p.id
          AND ps.staff_id = auth.uid()
        )
      )
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_folder_templates_active ON folder_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_project_folders_project_id ON project_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_status ON project_folders(status);
