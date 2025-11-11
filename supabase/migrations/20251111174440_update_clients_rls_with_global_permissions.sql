/*
  # Update Clients RLS to Include Global Permissions

  1. Changes
    - Update SELECT policy to check user_global_permissions.client_view_all and channel_partner_view_all
    - Update UPDATE policy to check user_global_permissions.client_edit_all and channel_partner_edit_all
    - Keep existing checks for creator, sales person, and specific permissions
    
  2. Logic
    - For regular clients (channel_partner_id IS NULL):
      - User must have client_view_all OR be creator/sales person OR have specific permission
    - For channel partners (channel_partner_id IS NOT NULL):
      - User must have channel_partner_view_all OR be creator/sales person OR have specific permission
    
  3. Security
    - Maintains existing security while adding global permission checks
    - No user can delete clients (only admins)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authorized users can view clients" ON clients;
DROP POLICY IF EXISTS "Authorized users can edit clients" ON clients;

-- Create new SELECT policy with global permissions
CREATE POLICY "Authorized users can view clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    -- Creator always has access
    created_by = auth.uid()
    OR
    -- Sales person always has access
    sales_person_id = auth.uid()
    OR
    -- Admin has access to everything
    check_is_admin(auth.uid())
    OR
    -- User has specific permission for this client
    EXISTS (
      SELECT 1 FROM client_permissions
      WHERE client_permissions.client_id = clients.id
      AND client_permissions.user_id = auth.uid()
      AND client_permissions.can_view = true
    )
    OR
    -- User has global permission for regular clients
    (
      clients.channel_partner_id IS NULL
      AND EXISTS (
        SELECT 1 FROM user_global_permissions
        WHERE user_global_permissions.user_id = auth.uid()
        AND user_global_permissions.client_view_all = true
      )
    )
    OR
    -- User has global permission for channel partners
    (
      clients.channel_partner_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_global_permissions
        WHERE user_global_permissions.user_id = auth.uid()
        AND user_global_permissions.channel_partner_view_all = true
      )
    )
  );

-- Create new UPDATE policy with global permissions
CREATE POLICY "Authorized users can edit clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (
    -- Creator always has access
    created_by = auth.uid()
    OR
    -- Sales person always has access
    sales_person_id = auth.uid()
    OR
    -- Admin has access to everything
    check_is_admin(auth.uid())
    OR
    -- User has specific permission for this client
    EXISTS (
      SELECT 1 FROM client_permissions
      WHERE client_permissions.client_id = clients.id
      AND client_permissions.user_id = auth.uid()
      AND client_permissions.can_edit = true
    )
    OR
    -- User has global permission for regular clients
    (
      clients.channel_partner_id IS NULL
      AND EXISTS (
        SELECT 1 FROM user_global_permissions
        WHERE user_global_permissions.user_id = auth.uid()
        AND user_global_permissions.client_edit_all = true
      )
    )
    OR
    -- User has global permission for channel partners
    (
      clients.channel_partner_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_global_permissions
        WHERE user_global_permissions.user_id = auth.uid()
        AND user_global_permissions.channel_partner_edit_all = true
      )
    )
  )
  WITH CHECK (
    -- Same conditions for update check
    created_by = auth.uid()
    OR
    sales_person_id = auth.uid()
    OR
    check_is_admin(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM client_permissions
      WHERE client_permissions.client_id = clients.id
      AND client_permissions.user_id = auth.uid()
      AND client_permissions.can_edit = true
    )
    OR
    (
      clients.channel_partner_id IS NULL
      AND EXISTS (
        SELECT 1 FROM user_global_permissions
        WHERE user_global_permissions.user_id = auth.uid()
        AND user_global_permissions.client_edit_all = true
      )
    )
    OR
    (
      clients.channel_partner_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_global_permissions
        WHERE user_global_permissions.user_id = auth.uid()
        AND user_global_permissions.channel_partner_edit_all = true
      )
    )
  );
