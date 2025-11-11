/*
  # Create User Global Permissions Table

  1. New Table
    - `user_global_permissions`
      - `user_id` (uuid, primary key) - Foreign key to staff
      - `client_view_all` (boolean) - User can view all clients
      - `client_edit_all` (boolean) - User can edit all clients
      - `channel_partner_view_all` (boolean) - User can view all channel partners
      - `channel_partner_edit_all` (boolean) - User can edit all channel partners
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Purpose
    - Control global access permissions for clients and channel partners
    - Users without "view all" or "edit all" permissions can still access records they created or are sales person for
    - No user can delete clients or channel partners (enforced by application logic)
    
  3. Security
    - Enable RLS
    - All authenticated users can view all permissions (for admin display)
    - Only admins can modify permissions
*/

-- Create user_global_permissions table
CREATE TABLE IF NOT EXISTS user_global_permissions (
  user_id uuid PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
  client_view_all boolean DEFAULT false,
  client_edit_all boolean DEFAULT false,
  channel_partner_view_all boolean DEFAULT false,
  channel_partner_edit_all boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_global_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view permissions (for admin display)
CREATE POLICY "Authenticated users can view user global permissions"
  ON user_global_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert permissions
CREATE POLICY "Admins can insert user global permissions"
  ON user_global_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can update permissions
CREATE POLICY "Admins can update user global permissions"
  ON user_global_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can delete permissions
CREATE POLICY "Admins can delete user global permissions"
  ON user_global_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_global_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER set_user_global_permissions_updated_at
  BEFORE UPDATE ON user_global_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_global_permissions_updated_at();

-- Create index for user_id (already primary key, so indexed by default)

-- Add comments for documentation
COMMENT ON TABLE user_global_permissions IS 'Global access permissions for users to view/edit all clients and channel partners';
COMMENT ON COLUMN user_global_permissions.client_view_all IS 'User can view all clients (creators and sales persons automatically have access to their clients)';
COMMENT ON COLUMN user_global_permissions.client_edit_all IS 'User can edit all clients (creators and sales persons automatically have edit access to their clients)';
COMMENT ON COLUMN user_global_permissions.channel_partner_view_all IS 'User can view all channel partners (creators and sales persons automatically have access to their channel partners)';
COMMENT ON COLUMN user_global_permissions.channel_partner_edit_all IS 'User can edit all channel partners (creators and sales persons automatically have edit access to their channel partners)';
