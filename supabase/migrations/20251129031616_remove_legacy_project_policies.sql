/*
  # Remove Legacy Project Policies
  
  1. Problem
    - Multiple conflicting RLS policies exist on projects table
    - Old policies "Users can view/update projects they have access to" conflict with new optimized policies
    
  2. Solution
    - Remove all legacy policies
    - Keep only the new optimized policies
    
  3. Security
    - New policies provide same or better security
    - Maintains admin, creator, sales person, and permission-based access
*/

-- Remove old legacy policies
DROP POLICY IF EXISTS "Users can view projects they have access to" ON projects;
DROP POLICY IF EXISTS "Users can update projects they have access to" ON projects;
DROP POLICY IF EXISTS "Only admins can delete projects" ON projects;
DROP POLICY IF EXISTS "Only admin can delete projects" ON projects;

-- Keep the new optimized policies:
-- "Staff can view all projects via status permissions"
-- "Staff can update projects via status permissions"
-- "Authenticated users can create projects"
-- "Project creators can delete projects"
