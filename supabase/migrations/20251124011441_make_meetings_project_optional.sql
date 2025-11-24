/*
  # Make Meetings Project-Independent

  1. Changes
    - Make project_id nullable in meetings table
    - Make project_id nullable in meeting_tasks table
    - Update RLS policies to allow all authenticated users to view/manage general meetings
    - Keep project-specific meeting access if project_id is provided

  2. Security
    - General meetings (project_id IS NULL) are accessible to all authenticated users
    - Project-specific meetings still respect project permissions
*/

-- Make project_id nullable in meetings
ALTER TABLE meetings ALTER COLUMN project_id DROP NOT NULL;

-- Make project_id nullable in meeting_tasks
ALTER TABLE meeting_tasks ALTER COLUMN project_id DROP NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view meetings for projects they have access to" ON meetings;
DROP POLICY IF EXISTS "Project staff can create meetings" ON meetings;
DROP POLICY IF EXISTS "Project staff can update meetings" ON meetings;
DROP POLICY IF EXISTS "Project staff can delete meetings" ON meetings;

-- Create new policies that handle both general and project-specific meetings
CREATE POLICY "Users can view general and accessible project meetings"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
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

CREATE POLICY "Authenticated users can create meetings"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
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

CREATE POLICY "Users can update meetings they have access to"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
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
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
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

CREATE POLICY "Users can delete meetings they have access to"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
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

-- Update meeting_tasks policies
DROP POLICY IF EXISTS "Users can view meeting tasks for projects they have access to" ON meeting_tasks;
DROP POLICY IF EXISTS "Project staff can create meeting tasks" ON meeting_tasks;
DROP POLICY IF EXISTS "Users can update their assigned meeting tasks" ON meeting_tasks;
DROP POLICY IF EXISTS "Project staff can delete meeting tasks" ON meeting_tasks;

CREATE POLICY "Users can view general and accessible project meeting tasks"
  ON meeting_tasks
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meeting_tasks.project_id
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

CREATE POLICY "Authenticated users can create meeting tasks"
  ON meeting_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meeting_tasks.project_id
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

CREATE POLICY "Users can update meeting tasks they have access to"
  ON meeting_tasks
  FOR UPDATE
  TO authenticated
  USING (
    project_id IS NULL
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meeting_tasks.project_id
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
    project_id IS NULL
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meeting_tasks.project_id
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

CREATE POLICY "Users can delete meeting tasks they have access to"
  ON meeting_tasks
  FOR DELETE
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meeting_tasks.project_id
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