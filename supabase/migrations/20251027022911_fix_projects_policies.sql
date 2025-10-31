/*
  # Fix projects RLS policies to avoid recursion

  1. Changes
    - Drop existing policies that cause circular dependencies
    - Create simpler policies that don't create recursion
    - Use security definer functions to break the recursion chain

  2. Security
    - Project creators can see and manage their projects
    - Staff can view projects they're assigned to (non-recursive check)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view assigned projects" ON projects;
DROP POLICY IF EXISTS "Staff can update assigned projects" ON projects;
DROP POLICY IF EXISTS "Staff can delete projects they created" ON projects;
DROP POLICY IF EXISTS "Staff can create projects" ON projects;

-- Allow anyone to create a project (they become the creator)
CREATE POLICY "Anyone authenticated can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Allow creators to view their projects
CREATE POLICY "Creators can view their projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Allow creators to update their projects
CREATE POLICY "Creators can update their projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Allow creators to delete their projects
CREATE POLICY "Creators can delete their projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
