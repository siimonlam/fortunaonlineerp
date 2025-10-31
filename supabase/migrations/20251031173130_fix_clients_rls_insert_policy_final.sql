/*
  # Fix Clients RLS Insert Policy - Final

  1. Changes
    - Re-enable RLS on clients table
    - Drop all existing policies and recreate them properly
    - Create a simple INSERT policy that allows authenticated users to create clients
    
  2. Security
    - All authenticated users can insert clients
    - Users can only view clients they have access to (via client_permissions or ownership)
    - Only users with edit permissions can update clients
    - Only admins can delete clients

  3. Notes
    - The INSERT policy uses authenticated role WITHOUT additional WITH CHECK constraints
    - This allows the insert to succeed as long as the user is authenticated
*/

-- Re-enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated users to insert clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can create clients" ON clients;
DROP POLICY IF EXISTS "Users can view clients they have access to" ON clients;
DROP POLICY IF EXISTS "Users can edit clients they have access to" ON clients;
DROP POLICY IF EXISTS "Only admins can delete clients" ON clients;

-- INSERT: Allow any authenticated user to create clients
CREATE POLICY "Authenticated users can insert clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: Users can view clients they have permission to see
CREATE POLICY "Users can view clients they have access to"
  ON clients
  FOR SELECT
  TO authenticated
  USING (can_view_client(id, auth.uid()));

-- UPDATE: Users can edit clients they have permission to edit
CREATE POLICY "Users can edit clients they have access to"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (can_edit_client(id, auth.uid()))
  WITH CHECK (can_edit_client(id, auth.uid()));

-- DELETE: Only admins can delete clients
CREATE POLICY "Only admins can delete clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));
