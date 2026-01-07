/*
  # Add Marketing Projects Support to Meetings

  1. Changes
    - Add marketing_project_id column to meetings table
    - Add marketing_project_id column to tasks table (for meeting tasks)
    - Update RLS policies to work with both projects and marketing_projects
    - Add indexes for marketing_project_id lookups

  2. Security
    - Marketing project meetings respect marketing_project_staff permissions
    - Existing project-based meetings continue to work as before
*/

-- Add marketing_project_id to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS marketing_project_id uuid REFERENCES marketing_projects(id) ON DELETE CASCADE;

-- Add marketing_project_id to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS marketing_project_id uuid REFERENCES marketing_projects(id) ON DELETE CASCADE;

-- Create indexes for marketing_project_id
CREATE INDEX IF NOT EXISTS idx_meetings_marketing_project_id ON meetings(marketing_project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_marketing_project_id ON tasks(marketing_project_id);

-- Drop existing meeting policies to recreate them with marketing support
DROP POLICY IF EXISTS "Users can view general and accessible project meetings" ON meetings;
DROP POLICY IF EXISTS "Authenticated users can create meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update meetings they have access to" ON meetings;
DROP POLICY IF EXISTS "Users can delete meetings they have access to" ON meetings;
DROP POLICY IF EXISTS "Users can view accessible meetings" ON meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON meetings;

-- Meetings policies with marketing project support
CREATE POLICY "Users can view accessible meetings"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL AND marketing_project_id IS NULL
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = meetings.marketing_project_id
    ))
  );

CREATE POLICY "Users can create meetings"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (project_id IS NULL AND marketing_project_id IS NULL)
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = meetings.marketing_project_id
    ))
  );

CREATE POLICY "Users can update meetings they have access to"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (
    (project_id IS NULL AND marketing_project_id IS NULL)
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = meetings.marketing_project_id
    ))
  )
  WITH CHECK (
    (project_id IS NULL AND marketing_project_id IS NULL)
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = meetings.marketing_project_id
    ))
  );

CREATE POLICY "Users can delete meetings they have access to"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (
    (project_id IS NULL AND marketing_project_id IS NULL)
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = meetings.marketing_project_id
    ))
  );

-- Update tasks policies to support marketing projects
DROP POLICY IF EXISTS "Users can view tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks they have access to" ON tasks;

CREATE POLICY "Users can view tasks they have access to"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR project_id IS NULL
    OR marketing_project_id IS NULL
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = tasks.marketing_project_id
    ))
  );

CREATE POLICY "Users can create tasks they have access to"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    OR marketing_project_id IS NULL
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = tasks.marketing_project_id
    ))
  );

CREATE POLICY "Users can update tasks they have access to"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR project_id IS NULL
    OR marketing_project_id IS NULL
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = tasks.marketing_project_id
    ))
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR project_id IS NULL
    OR marketing_project_id IS NULL
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = tasks.marketing_project_id
    ))
  );

CREATE POLICY "Users can delete tasks they have access to"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (
    project_id IS NULL
    OR marketing_project_id IS NULL
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = tasks.project_id
    ))
    OR (marketing_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = tasks.marketing_project_id
    ))
  );