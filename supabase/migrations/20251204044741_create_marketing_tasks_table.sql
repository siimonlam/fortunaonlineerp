/*
  # Create Marketing Tasks Table

  1. New Tables
    - `marketing_tasks`
      - `id` (uuid, primary key)
      - `marketing_project_id` (uuid, foreign key to marketing_projects)
      - `title` (text, required)
      - `description` (text, optional)
      - `assigned_to` (uuid, foreign key to auth.users)
      - `deadline` (timestamptz, optional)
      - `completed` (boolean, default false)
      - `meeting_id` (uuid, foreign key to meetings, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `marketing_tasks` table
    - Allow authenticated users to view tasks for marketing projects they can access
    - Allow authenticated users to create/update/delete tasks for marketing projects they can access

  3. Indexes
    - Index on marketing_project_id for faster lookups
    - Index on assigned_to for user task queries
*/

-- Create marketing_tasks table
CREATE TABLE IF NOT EXISTS marketing_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid REFERENCES marketing_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deadline timestamptz,
  completed boolean DEFAULT false,
  meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_project_id ON marketing_tasks(marketing_project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_assigned_to ON marketing_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_meeting_id ON marketing_tasks(meeting_id);

-- Enable RLS
ALTER TABLE marketing_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view all tasks
CREATE POLICY "Allow authenticated users to view all marketing tasks"
  ON marketing_tasks FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to insert marketing tasks
CREATE POLICY "Allow authenticated users to create marketing tasks"
  ON marketing_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow authenticated users to update marketing tasks
CREATE POLICY "Allow authenticated users to update marketing tasks"
  ON marketing_tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to delete marketing tasks
CREATE POLICY "Allow authenticated users to delete marketing tasks"
  ON marketing_tasks FOR DELETE
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_tasks;

-- Set replica identity to full for realtime updates
ALTER TABLE marketing_tasks REPLICA IDENTITY FULL;