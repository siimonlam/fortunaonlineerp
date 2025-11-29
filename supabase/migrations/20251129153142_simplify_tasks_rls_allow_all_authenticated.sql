/*
  # Simplify Tasks RLS - Allow All Authenticated Users

  This migration simplifies the RLS policies on the tasks table to allow all authenticated users to view and edit all tasks.
  
  1. Changes
    - Drop all existing restrictive RLS policies on tasks table
    - Keep only simple policies that allow all authenticated users full access
    - SELECT: All authenticated users can view all tasks
    - INSERT: All authenticated users can create tasks
    - UPDATE: All authenticated users can update tasks
    - DELETE: All authenticated users can delete tasks
  
  2. Security
    - RLS remains enabled
    - Access restricted to authenticated users only
    - Anonymous users cannot access tasks
*/

-- Drop all existing task policies
DROP POLICY IF EXISTS "Users can view tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks they have access to" ON tasks;
DROP POLICY IF EXISTS "All authenticated users can view tasks" ON tasks;
DROP POLICY IF EXISTS "All authenticated users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "All authenticated users can update tasks" ON tasks;
DROP POLICY IF EXISTS "All authenticated users can delete tasks" ON tasks;

-- Create simple policies for all authenticated users
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
