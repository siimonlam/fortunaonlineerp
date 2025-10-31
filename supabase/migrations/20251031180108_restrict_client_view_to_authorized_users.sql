/*
  # Restrict Client View Access to Authorized Users Only

  1. Authorization Rules
    - Any authenticated user can create clients
    - Regular users can only view clients they created or are sales person for
    - Admins can view all clients
    - Only creator, sales person, users with explicit permissions, or admins can edit
    - Only admins can delete
    
  2. Security
    - View access is restricted to authorized users only
    - Edit access follows the same authorization rules
    - Delete access is admin-only
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated users can create clients" ON clients;
DROP POLICY IF EXISTS "All users can view all clients" ON clients;
DROP POLICY IF EXISTS "Authorized users can edit clients" ON clients;
DROP POLICY IF EXISTS "Only admins can delete clients" ON clients;

-- INSERT: Any authenticated user can create clients
CREATE POLICY "Any user can create clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: Only creator, sales person, users with permissions, or admins can view
CREATE POLICY "Authorized users can view clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR sales_person_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM client_permissions
      WHERE client_permissions.client_id = clients.id
      AND client_permissions.user_id = auth.uid()
      AND client_permissions.can_view = true
    )
  );

-- UPDATE: Only creator, sales person, users with edit permissions, or admins can edit
CREATE POLICY "Authorized users can edit clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR sales_person_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM client_permissions
      WHERE client_permissions.client_id = clients.id
      AND client_permissions.user_id = auth.uid()
      AND client_permissions.can_edit = true
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR sales_person_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM client_permissions
      WHERE client_permissions.client_id = clients.id
      AND client_permissions.user_id = auth.uid()
      AND client_permissions.can_edit = true
    )
  );

-- DELETE: Only admins can delete clients
CREATE POLICY "Only admins can delete clients"
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
