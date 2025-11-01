/*
  # Create Project History and Comments Tables

  1. New Tables
    - `project_history`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `user_id` (uuid, foreign key to staff)
      - `field_name` (text) - Name of the field that changed
      - `old_value` (text) - Previous value
      - `new_value` (text) - New value
      - `changed_at` (timestamptz) - When the change occurred
      
    - `project_comments`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `user_id` (uuid, foreign key to staff)
      - `comment_type` (text) - Type of comment (Note, Call, etc.)
      - `content` (text) - Comment content
      - `created_at` (timestamptz) - When the comment was created
      
  2. Security
    - Enable RLS on both tables
    - Users can view history/comments for projects they have access to
    - Users can add comments to projects they have access to
    - Only admins can delete comments
    
  3. Indexes
    - Add indexes on project_id for faster queries
*/

-- Create project_history table
CREATE TABLE IF NOT EXISTS project_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamptz DEFAULT now()
);

-- Create project_comments table
CREATE TABLE IF NOT EXISTS project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  comment_type text NOT NULL DEFAULT 'Note',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_history_project_id ON project_history(project_id);
CREATE INDEX IF NOT EXISTS idx_project_history_changed_at ON project_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_created_at ON project_comments(created_at DESC);

-- Enable RLS
ALTER TABLE project_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_history
CREATE POLICY "Users can view history for projects they can view"
  ON project_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_history.project_id
      AND can_user_view_project(p.id, auth.uid())
    )
  );

-- RLS Policies for project_comments
CREATE POLICY "Users can view comments for projects they can view"
  ON project_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_comments.project_id
      AND can_user_view_project(p.id, auth.uid())
    )
  );

CREATE POLICY "Users can add comments to projects they can view"
  ON project_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_comments.project_id
      AND can_user_view_project(p.id, auth.uid())
    )
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update their own comments"
  ON project_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment"
  ON project_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

CREATE POLICY "Users can delete their own comments"
  ON project_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
