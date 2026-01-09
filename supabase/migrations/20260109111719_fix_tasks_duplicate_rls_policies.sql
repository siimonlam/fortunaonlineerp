/*
  # Fix Duplicate RLS Policies on Tasks Table
  
  The tasks table currently has duplicate RLS policies - both old restrictive policies
  and new simple policies coexist, causing confusion and potential access issues.
  
  1. Changes
    - Drop ALL existing RLS policies on tasks table
    - Recreate only the simple "allow all authenticated users" policies
    - Ensure clean slate with no conflicts
  
  2. Security
    - RLS remains enabled
    - All authenticated users can access all tasks
    - Anonymous users cannot access tasks
*/

-- Drop ALL existing policies on tasks table
DROP POLICY IF EXISTS "Users can view tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "All authenticated users can view all tasks" ON tasks;
DROP POLICY IF EXISTS "All authenticated users can create all tasks" ON tasks;
DROP POLICY IF EXISTS "All authenticated users can update all tasks" ON tasks;
DROP POLICY IF EXISTS "All authenticated users can delete all tasks" ON tasks;

-- Recreate simple policies for all authenticated users
CREATE POLICY "All authenticated users can view all tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can create all tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update all tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "All authenticated users can delete all tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (true);
