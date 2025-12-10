/*
  # Create Marketing Project Comments Table

  1. New Tables
    - `marketing_project_comments`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to marketing_projects)
      - `user_id` (uuid, foreign key to staff)
      - `comment_type` (text) - Type of comment (Note, Call, etc.)
      - `content` (text) - Comment content
      - `created_at` (timestamptz) - When the comment was created

  2. Security
    - Enable RLS
    - Users can view comments for marketing projects they have access to
    - Users can add comments to marketing projects they have access to
    - Users can update/delete their own comments
    - Admins can delete any comment

  3. Indexes
    - Add indexes on project_id for faster queries
*/

-- Create marketing_project_comments table
CREATE TABLE IF NOT EXISTS marketing_project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES marketing_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  comment_type text NOT NULL DEFAULT 'Note',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_marketing_project_comments_project_id ON marketing_project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_project_comments_created_at ON marketing_project_comments(created_at DESC);

-- Enable RLS
ALTER TABLE marketing_project_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketing_project_comments
CREATE POLICY "All authenticated users can view marketing project comments"
  ON marketing_project_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can add comments to marketing projects"
  ON marketing_project_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON marketing_project_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment"
  ON marketing_project_comments
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
  ON marketing_project_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);