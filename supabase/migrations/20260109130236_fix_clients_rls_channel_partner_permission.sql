/*
  # Fix Clients RLS Policy - Remove Channel Partner Permission Bug

  ## Problem
  Users with `channel_partner_view_all` permission could see ALL clients that have a channel_partner_id reference,
  even though they should only have access to the channel_partners table itself, not the clients table.

  ## Changes
  1. Update the "Authorized users can view clients" policy to remove the channel_partner_view_all logic
  2. Update the "Authorized users can edit clients" policy to remove the channel_partner_edit_all logic
  
  ## Security
  - `client_view_all` permission = view all records in the clients table
  - `channel_partner_view_all` permission = should only apply to channel_partners table, NOT clients table
*/

-- Drop the existing policies
DROP POLICY IF EXISTS "Authorized users can view clients" ON clients;
DROP POLICY IF EXISTS "Authorized users can edit clients" ON clients;

-- Recreate the view policy without channel_partner permission check
CREATE POLICY "Authorized users can view clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() 
    OR sales_person_id = auth.uid() 
    OR check_is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM client_permissions 
      WHERE client_permissions.client_id = clients.id 
        AND client_permissions.user_id = auth.uid() 
        AND client_permissions.can_view = true
    )
    OR EXISTS (
      SELECT 1 FROM user_global_permissions 
      WHERE user_global_permissions.user_id = auth.uid() 
        AND user_global_permissions.client_view_all = true
    )
  );

-- Recreate the edit policy without channel_partner permission check
CREATE POLICY "Authorized users can edit clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() 
    OR sales_person_id = auth.uid() 
    OR check_is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM client_permissions 
      WHERE client_permissions.client_id = clients.id 
        AND client_permissions.user_id = auth.uid() 
        AND client_permissions.can_edit = true
    )
    OR EXISTS (
      SELECT 1 FROM user_global_permissions 
      WHERE user_global_permissions.user_id = auth.uid() 
        AND user_global_permissions.client_edit_all = true
    )
  )
  WITH CHECK (
    created_by = auth.uid() 
    OR sales_person_id = auth.uid() 
    OR check_is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM client_permissions 
      WHERE client_permissions.client_id = clients.id 
        AND client_permissions.user_id = auth.uid() 
        AND client_permissions.can_edit = true
    )
    OR EXISTS (
      SELECT 1 FROM user_global_permissions 
      WHERE user_global_permissions.user_id = auth.uid() 
        AND user_global_permissions.client_edit_all = true
    )
  );
