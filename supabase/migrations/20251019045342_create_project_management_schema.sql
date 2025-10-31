/*
  # Project Management System Schema

  1. New Tables
    - `staff`
      - `id` (uuid, primary key) - Links to auth.users
      - `email` (text, unique) - Staff email address
      - `full_name` (text) - Staff full name
      - `avatar_url` (text, nullable) - Profile picture URL
      - `created_at` (timestamptz) - Record creation timestamp
    
    - `statuses`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Status name (Hi-Po, Presubmission, Q&A, Final Report)
      - `order_index` (integer) - Order of status in workflow
      - `created_at` (timestamptz)
    
    - `projects`
      - `id` (uuid, primary key)
      - `title` (text) - Project title
      - `description` (text, nullable) - Project description
      - `status_id` (uuid, foreign key) - Current status
      - `created_by` (uuid, foreign key) - Staff who created project
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `project_staff`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key) - Project reference
      - `staff_id` (uuid, foreign key) - Staff reference
      - `created_at` (timestamptz)
      - Unique constraint on (project_id, staff_id)
    
    - `tasks`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key) - Parent project
      - `title` (text) - Task title
      - `description` (text, nullable) - Task description
      - `assigned_to` (uuid, foreign key, nullable) - Assigned staff member
      - `deadline` (timestamptz, nullable) - Task deadline
      - `completed` (boolean) - Completion status
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Staff can view their own profile and other staff members
    - Staff can only view/manage projects they are assigned to
    - Staff can only view/manage tasks for projects they are assigned to
    - Statuses are readable by all authenticated users

  3. Initial Data
    - Pre-populate the four statuses: Hi-Po, Presubmission, Q&A, Final Report
*/

-- Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Create statuses table
CREATE TABLE IF NOT EXISTS statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status_id uuid NOT NULL REFERENCES statuses(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create project_staff junction table
CREATE TABLE IF NOT EXISTS project_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, staff_id)
);

ALTER TABLE project_staff ENABLE ROW LEVEL SECURITY;

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES staff(id) ON DELETE SET NULL,
  deadline timestamptz,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff
CREATE POLICY "Staff can view all staff members"
  ON staff FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can update own profile"
  ON staff FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Staff can insert own profile"
  ON staff FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for statuses
CREATE POLICY "Authenticated users can view statuses"
  ON statuses FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for projects
CREATE POLICY "Staff can view assigned projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = projects.id
      AND project_staff.staff_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Staff can update assigned projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = projects.id
      AND project_staff.staff_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = projects.id
      AND project_staff.staff_id = auth.uid()
    )
  );

CREATE POLICY "Staff can delete projects they created"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for project_staff
CREATE POLICY "Staff can view project assignments for their projects"
  ON project_staff FOR SELECT
  TO authenticated
  USING (
    staff_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM project_staff ps
      WHERE ps.project_id = project_staff.project_id
      AND ps.staff_id = auth.uid()
    )
  );

CREATE POLICY "Project creators can assign staff"
  ON project_staff FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_staff.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Project creators can remove staff"
  ON project_staff FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_staff.project_id
      AND projects.created_by = auth.uid()
    )
  );

-- RLS Policies for tasks
CREATE POLICY "Staff can view tasks for assigned projects"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = tasks.project_id
      AND project_staff.staff_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create tasks for assigned projects"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = tasks.project_id
      AND project_staff.staff_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update tasks for assigned projects"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = tasks.project_id
      AND project_staff.staff_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = tasks.project_id
      AND project_staff.staff_id = auth.uid()
    )
  );

CREATE POLICY "Staff can delete tasks for assigned projects"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_staff
      WHERE project_staff.project_id = tasks.project_id
      AND project_staff.staff_id = auth.uid()
    )
  );

-- Insert default statuses
INSERT INTO statuses (name, order_index) VALUES
  ('Hi-Po', 1),
  ('Presubmission', 2),
  ('Q&A', 3),
  ('Final Report', 4)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_project_staff_project ON project_staff(project_id);
CREATE INDEX IF NOT EXISTS idx_project_staff_staff ON project_staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
