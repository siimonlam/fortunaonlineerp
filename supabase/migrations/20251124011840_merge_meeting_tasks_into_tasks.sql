/*
  # Merge Meeting Tasks into Tasks Table

  1. Changes
    - Add meeting_id column to tasks table
    - Make project_id nullable in tasks table (for general meeting tasks)
    - Migrate all meeting_tasks data to tasks table
    - Drop meeting_tasks table
    - Update RLS policies to handle meeting tasks

  2. Security
    - Maintain existing task permissions
    - Meeting tasks follow the same access rules as project tasks
*/

-- Add meeting_id column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE;

-- Make project_id nullable in tasks table
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;

-- Create index on meeting_id
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON tasks(meeting_id);

-- Migrate data from meeting_tasks to tasks
INSERT INTO tasks (id, project_id, title, description, assigned_to, deadline, completed, meeting_id, created_at, updated_at)
SELECT id, project_id, title, description, assigned_to, deadline, completed, meeting_id, created_at, updated_at
FROM meeting_tasks
ON CONFLICT (id) DO NOTHING;

-- Drop meeting_tasks table
DROP TABLE IF EXISTS meeting_tasks CASCADE;

-- Update RLS policies for tasks to handle both project and meeting tasks
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can update their tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their projects" ON tasks;

-- View policy: users can see tasks they're assigned to, or tasks in projects they have access to
CREATE POLICY "Users can view tasks they have access to"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
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

-- Create policy: users can create tasks in projects they have access to, or general tasks
CREATE POLICY "Users can create tasks they have access to"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
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

-- Update policy: users can update tasks they're assigned to or have project access to
CREATE POLICY "Users can update tasks they have access to"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_staff ps
          WHERE ps.project_id = p.id
          AND ps.staff_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
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

-- Delete policy: users can delete tasks in projects they have access to
CREATE POLICY "Users can delete tasks they have access to"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
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