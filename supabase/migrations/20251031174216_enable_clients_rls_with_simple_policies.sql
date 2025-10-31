/*
  # Enable RLS on Clients with Simple Policies

  1. Changes
    - Re-enable RLS on clients table
    - Create simple, working policies for all operations
    
  2. Security
    - Anyone authenticated can create clients
    - Users can view clients they have access to
    - Users can edit clients they have access to
    - Only admins can delete clients

  3. Notes
    - All policies use simple, direct checks without complex function calls where possible
*/

-- Re-enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first
DROP POLICY IF EXISTS "Allow client creation" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can view clients they have access to" ON clients;
DROP POLICY IF EXISTS "Users can edit clients they have access to" ON clients;
DROP POLICY IF EXISTS "Only admins can delete clients" ON clients;

-- INSERT: Allow any authenticated user
CREATE POLICY "Anyone can create clients"
  ON clients
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: Users can view clients they have access to
CREATE POLICY "View accessible clients"
  ON clients
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      created_by = auth.uid() 
      OR sales_person_id = auth.uid()
      OR is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM client_permissions
        WHERE client_permissions.client_id = clients.id
        AND client_permissions.user_id = auth.uid()
        AND client_permissions.can_view = true
      )
    )
  );

-- UPDATE: Users can edit clients they have access to
CREATE POLICY "Edit accessible clients"
  ON clients
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      created_by = auth.uid()
      OR sales_person_id = auth.uid()
      OR is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM client_permissions
        WHERE client_permissions.client_id = clients.id
        AND client_permissions.user_id = auth.uid()
        AND client_permissions.can_edit = true
      )
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      created_by = auth.uid()
      OR sales_person_id = auth.uid()
      OR is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM client_permissions
        WHERE client_permissions.client_id = clients.id
        AND client_permissions.user_id = auth.uid()
        AND client_permissions.can_edit = true
      )
    )
  );

-- DELETE: Only admins can delete
CREATE POLICY "Admins can delete clients"
  ON clients
  FOR DELETE
  USING (is_admin(auth.uid()));
