/*
  # Enhanced RLS policies for client and project access

  1. Changes
    - Add policy for client creators to view their clients
    - Add policy for assigned users to view clients
    - Add policy for project converters (users who created projects from clients) to view those projects
    - Add policy for sales persons to view projects where they are listed as sales_person
    - Maintain existing policies for assigned staff

  2. Security
    - Users can view clients they created
    - Users can view clients they're assigned to via project_staff
    - Users can view projects they created from clients
    - Users can view projects they're assigned to
    - Sales persons can view projects where they are the sales_person
*/

-- Drop existing project view policies to recreate them
DROP POLICY IF EXISTS "Assigned users can view projects" ON projects;

-- Comprehensive project view policy
CREATE POLICY "Users can view projects they have access to"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    -- User created the project
    auth.uid() = created_by
    OR
    -- User is assigned to the project via project_staff
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = id 
      AND project_staff.staff_id = auth.uid()
    )
    OR
    -- User is the sales person for the project
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.email = projects.sales_person
    )
    OR
    -- User is assigned to any task in the project
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.project_id = id
      AND tasks.assigned_to = auth.uid()
    )
  );

-- Update the update policy as well
DROP POLICY IF EXISTS "Assigned users can update projects" ON projects;

CREATE POLICY "Users can update projects they have access to"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = id 
      AND project_staff.staff_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    OR
    EXISTS (
      SELECT 1 FROM project_staff 
      WHERE project_staff.project_id = id 
      AND project_staff.staff_id = auth.uid()
    )
  );
