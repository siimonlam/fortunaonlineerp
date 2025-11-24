/*
  # Create Meetings Feature for Funding Projects

  1. New Tables
    - `meetings`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `title` (text, meeting title)
      - `description` (text, meeting notes/description)
      - `meeting_date` (timestamptz, when the meeting happened)
      - `location` (text, meeting location or platform)
      - `attendees` (text[], array of attendee names or user IDs)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `meeting_tasks`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to meetings)
      - `project_id` (uuid, foreign key to projects)
      - `title` (text, task title)
      - `description` (text, task description)
      - `assigned_to` (uuid, foreign key to auth.users)
      - `deadline` (timestamptz, task deadline)
      - `completed` (boolean, task completion status)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Allow users with project access to view meetings
    - Allow project staff to create and edit meetings
    - Meeting tasks inherit project permissions

  3. Indexes
    - Index on project_id for fast lookups
    - Index on meeting_date for chronological sorting
*/

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  meeting_date timestamptz NOT NULL,
  location text DEFAULT '',
  attendees text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create meeting_tasks table
CREATE TABLE IF NOT EXISTS meeting_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deadline timestamptz,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_meeting_id ON meeting_tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_project_id ON meeting_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_assigned_to ON meeting_tasks(assigned_to);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_tasks ENABLE ROW LEVEL SECURITY;

-- Meetings policies: Allow users with project access to view meetings
CREATE POLICY "Users can view meetings for projects they have access to"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
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

-- Allow project staff to create meetings
CREATE POLICY "Project staff can create meetings"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
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

-- Allow project staff to update meetings
CREATE POLICY "Project staff can update meetings"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
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
    EXISTS (
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

-- Allow project staff to delete meetings
CREATE POLICY "Project staff can delete meetings"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
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

-- Meeting tasks policies: Same as meetings, inherit from project permissions
CREATE POLICY "Users can view meeting tasks for projects they have access to"
  ON meeting_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meeting_tasks.project_id
      AND (
        p.created_by = auth.uid()
        OR assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_staff ps
          WHERE ps.project_id = p.id
          AND ps.staff_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Project staff can create meeting tasks"
  ON meeting_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
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

CREATE POLICY "Users can update their assigned meeting tasks"
  ON meeting_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meeting_tasks.project_id
      AND (
        p.created_by = auth.uid()
        OR assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_staff ps
          WHERE ps.project_id = p.id
          AND ps.staff_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meeting_tasks.project_id
      AND (
        p.created_by = auth.uid()
        OR assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_staff ps
          WHERE ps.project_id = p.id
          AND ps.staff_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Project staff can delete meeting tasks"
  ON meeting_tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
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

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_tasks;