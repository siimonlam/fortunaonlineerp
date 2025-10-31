/*
  # Update RLS policies for user-based project visibility

  1. Changes
    - Drop existing project policies
    - Create new policies so only assigned users can see projects
    - Project creator is automatically assigned via project_staff
    - Update task policies to work with new project visibility

  2. Security
    - Users can only see projects they're assigned to via project_staff
    - Users can only see tasks for projects they're assigned to
    - Maintain proper access control for updates and deletes
*/

-- Drop existing project policies
DROP POLICY IF EXISTS "Anyone authenticated can create projects" ON projects;
DROP POLICY IF EXISTS "Creators can view their projects" ON projects;
DROP POLICY IF EXISTS "Creators can update their projects" ON projects;
DROP POLICY IF EXISTS "Creators can delete their projects" ON projects;

-- New project policies based on assignment
CREATE POLICY "Authenticated users can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Assigned users can view projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT staff_id FROM project_staff WHERE project_id = projects.id
    )
  );

CREATE POLICY "Assigned users can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT staff_id FROM project_staff WHERE project_id = projects.id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT staff_id FROM project_staff WHERE project_id = projects.id
    )
  );

CREATE POLICY "Project creators can delete projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Update task policies to work with new project visibility
DROP POLICY IF EXISTS "Staff can create tasks in assigned projects" ON tasks;
DROP POLICY IF EXISTS "Staff can view tasks in assigned projects" ON tasks;
DROP POLICY IF EXISTS "Staff can update tasks in assigned projects" ON tasks;
DROP POLICY IF EXISTS "Staff can delete tasks in assigned projects" ON tasks;

CREATE POLICY "Assigned users can create tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT staff_id FROM project_staff 
      WHERE project_id = tasks.project_id
    )
  );

CREATE POLICY "Assigned users can view tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT staff_id FROM project_staff 
      WHERE project_id = tasks.project_id
    )
  );

CREATE POLICY "Assigned users can update tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT staff_id FROM project_staff 
      WHERE project_id = tasks.project_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT staff_id FROM project_staff 
      WHERE project_id = tasks.project_id
    )
  );

CREATE POLICY "Assigned users can delete tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT staff_id FROM project_staff 
      WHERE project_id = tasks.project_id
    )
  );

-- Create function to automatically assign creator to project
CREATE OR REPLACE FUNCTION assign_creator_to_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_staff (project_id, staff_id)
  VALUES (NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS assign_creator_trigger ON projects;

CREATE TRIGGER assign_creator_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION assign_creator_to_project();
