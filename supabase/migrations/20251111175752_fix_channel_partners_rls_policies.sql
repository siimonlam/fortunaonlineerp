/*
  # Fix Channel Partners RLS Policies

  1. Changes
    - Replace overly permissive SELECT policy with proper access control
    - Update UPDATE policy to include global permissions
    - Restrict DELETE to admins only (same as clients)
    - Add same access control logic as clients table
    
  2. Security Logic
    - User must be creator OR sales person OR admin
    - OR have specific permission via channel_partner_permissions table
    - OR have global channel_partner_view_all permission
    
  3. Security
    - Removes "view all" access for authenticated users
    - Ensures only authorized users can see channel partners
    - Maintains consistency with clients table RLS
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view all channel partners" ON channel_partners;
DROP POLICY IF EXISTS "Users can update their own channel partners" ON channel_partners;
DROP POLICY IF EXISTS "Users can delete their own channel partners" ON channel_partners;

-- Create new SELECT policy with proper access control
CREATE POLICY "Authorized users can view channel partners"
  ON channel_partners
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
    -- User has specific permission for this channel partner
    EXISTS (
      SELECT 1 FROM channel_partner_permissions
      WHERE channel_partner_permissions.channel_partner_id = channel_partners.id
      AND channel_partner_permissions.user_id = auth.uid()
      AND channel_partner_permissions.can_view = true
    )
    OR
    -- User has global permission for channel partners
    EXISTS (
      SELECT 1 FROM user_global_permissions
      WHERE user_global_permissions.user_id = auth.uid()
      AND user_global_permissions.channel_partner_view_all = true
    )
  );

-- Create new UPDATE policy with proper access control
CREATE POLICY "Authorized users can edit channel partners"
  ON channel_partners
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
    -- User has specific permission for this channel partner
    EXISTS (
      SELECT 1 FROM channel_partner_permissions
      WHERE channel_partner_permissions.channel_partner_id = channel_partners.id
      AND channel_partner_permissions.user_id = auth.uid()
      AND channel_partner_permissions.can_edit = true
    )
    OR
    -- User has global permission for channel partners
    EXISTS (
      SELECT 1 FROM user_global_permissions
      WHERE user_global_permissions.user_id = auth.uid()
      AND user_global_permissions.channel_partner_edit_all = true
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
      SELECT 1 FROM channel_partner_permissions
      WHERE channel_partner_permissions.channel_partner_id = channel_partners.id
      AND channel_partner_permissions.user_id = auth.uid()
      AND channel_partner_permissions.can_edit = true
    )
    OR
    EXISTS (
      SELECT 1 FROM user_global_permissions
      WHERE user_global_permissions.user_id = auth.uid()
      AND user_global_permissions.channel_partner_edit_all = true
    )
  );

-- Create DELETE policy (only admins)
CREATE POLICY "Only admins can delete channel partners"
  ON channel_partners
  FOR DELETE
  TO authenticated
  USING (check_is_admin(auth.uid()));
