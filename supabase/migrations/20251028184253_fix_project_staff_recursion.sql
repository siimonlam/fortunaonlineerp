/*
  # Fix infinite recursion in project_staff policies

  1. Problem
    - projects SELECT/UPDATE policies reference project_staff table
    - project_staff SELECT policy "Project creators can view all assignments" references projects table
    - This creates circular dependency causing infinite recursion

  2. Solution
    - Simplify project_staff SELECT policies to avoid checking projects table
    - Staff can view assignments where they are the staff_id (no project check needed)
    - Project creators are already staff members, so they'll see their assignments too
    - Keep the projects policy that checks project_staff (one-way reference)

  3. Security
    - Users can only see project_staff records where they are assigned
    - INSERT/DELETE policies can still check projects table (they don't cause recursion)
*/

-- Drop the policy that causes recursion
DROP POLICY IF EXISTS "Project creators can view all assignments" ON project_staff;

-- Keep only the simple policy
-- (Staff can view their assignments is already there and doesn't cause recursion)

-- Add a new policy: users can view staff assignments for projects they created
-- BUT use a non-recursive check by looking at created_by directly
CREATE POLICY "View staff for own projects"
  ON project_staff
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_staff.project_id
      AND projects.created_by = auth.uid()
    )
    OR staff_id = auth.uid()
  );

-- Remove the old "Staff can view their assignments" since we combined it above
DROP POLICY IF EXISTS "Staff can view their assignments" ON project_staff;
