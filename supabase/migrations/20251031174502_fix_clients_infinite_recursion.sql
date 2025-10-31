/*
  # Fix Infinite Recursion in Clients Policies

  1. Changes
    - Remove is_admin() function calls from policies to avoid recursion
    - Use direct check on user_roles table instead
    
  2. Security
    - Anyone authenticated can create clients
    - Users can view/edit clients they created or are assigned to
    - Admins (checked via user_roles) can do everything
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can create clients" ON clients;
DROP POLICY IF EXISTS "View accessible clients" ON clients;
DROP POLICY IF EXISTS "Edit accessible clients" ON clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON clients;

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
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
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
  );

-- DELETE: Only admins can delete
CREATE POLICY "Admins can delete clients"
  ON clients
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
