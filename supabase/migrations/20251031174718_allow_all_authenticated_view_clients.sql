/*
  # Allow All Authenticated Users to View and Edit All Clients

  1. Changes
    - Drop restrictive policies
    - Create simple policies that allow all authenticated users to view and edit any client
    
  2. Security
    - Anyone authenticated can create, view, and edit any client
    - Only admins can delete clients
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can create clients" ON clients;
DROP POLICY IF EXISTS "View accessible clients" ON clients;
DROP POLICY IF EXISTS "Edit accessible clients" ON clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON clients;

-- INSERT: Allow any authenticated user
CREATE POLICY "Authenticated users can create clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: Allow all authenticated users to view all clients
CREATE POLICY "Authenticated users can view all clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE: Allow all authenticated users to edit all clients
CREATE POLICY "Authenticated users can edit all clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Only admins can delete
CREATE POLICY "Admins can delete clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
