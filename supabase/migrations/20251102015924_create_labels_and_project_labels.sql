/*
  # Create Labels System

  1. New Tables
    - `labels`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Name of the label
      - `color` (text) - Hex color code for the label
      - `created_by` (uuid) - Reference to staff who created it
      - `created_at` (timestamptz) - Creation timestamp
      - `order_index` (integer) - For sorting labels
    
    - `project_labels`
      - `id` (uuid, primary key)
      - `project_id` (uuid) - Reference to projects table
      - `label_id` (uuid) - Reference to labels table
      - `created_at` (timestamptz) - When label was assigned
      - Unique constraint on (project_id, label_id) to prevent duplicates

  2. Security
    - Enable RLS on both tables
    - Only authenticated users can view labels
    - Only admins can create, update, or delete labels
    - Anyone with project view permission can see project labels
    - Only admins can assign/remove labels from projects

  3. Indexes
    - Index on project_labels.project_id for faster lookups
    - Index on project_labels.label_id for faster reverse lookups
*/

-- Create labels table
CREATE TABLE IF NOT EXISTS labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#3B82F6',
  created_by uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  order_index integer DEFAULT 0
);

-- Create project_labels junction table
CREATE TABLE IF NOT EXISTS project_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, label_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_labels_project_id ON project_labels(project_id);
CREATE INDEX IF NOT EXISTS idx_project_labels_label_id ON project_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_labels_order_index ON labels(order_index);

-- Enable RLS
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_labels ENABLE ROW LEVEL SECURITY;

-- Labels policies: Anyone can view, only admins can manage
CREATE POLICY "Authenticated users can view labels"
  ON labels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can create labels"
  ON labels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.is_admin = true
    )
  );

CREATE POLICY "Admins can update labels"
  ON labels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.is_admin = true
    )
  );

CREATE POLICY "Admins can delete labels"
  ON labels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.is_admin = true
    )
  );

-- Project labels policies: View follows project permissions, manage is admin-only
CREATE POLICY "Users can view project labels for accessible projects"
  ON project_labels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_labels.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM staff
          WHERE staff.id = auth.uid()
          AND staff.is_admin = true
        )
        OR EXISTS (
          SELECT 1 FROM project_permissions pp
          WHERE pp.project_id = p.id
          AND pp.user_id = auth.uid()
          AND pp.can_view = true
        )
      )
    )
  );

CREATE POLICY "Admins can assign labels to projects"
  ON project_labels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.is_admin = true
    )
  );

CREATE POLICY "Admins can remove labels from projects"
  ON project_labels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.is_admin = true
    )
  );
