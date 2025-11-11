/*
  # Create Channel Partner Permissions Table

  1. New Table
    - `channel_partner_permissions`
      - `id` (uuid, primary key)
      - `channel_partner_id` (uuid) - Foreign key to channel_partners
      - `user_id` (uuid) - Foreign key to staff
      - `can_view` (boolean) - User can view this channel partner
      - `can_edit` (boolean) - User can edit this channel partner
      - `granted_by` (uuid) - Who granted this permission
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Purpose
    - Control granular access to channel partners
    - Allow admins to grant specific users view/edit access to specific channel partners
    - Creator and sales person automatically have access (enforced in application logic)
    
  3. Security
    - Enable RLS
    - Only admins can manage permissions
    - All authenticated users can view their own permissions
*/

-- Create channel_partner_permissions table
CREATE TABLE IF NOT EXISTS channel_partner_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_partner_id uuid REFERENCES channel_partners(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  granted_by uuid REFERENCES staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(channel_partner_id, user_id)
);

-- Enable RLS
ALTER TABLE channel_partner_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all permissions (for admin display)
CREATE POLICY "Authenticated users can view channel partner permissions"
  ON channel_partner_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert channel partner permissions
CREATE POLICY "Admins can insert channel partner permissions"
  ON channel_partner_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can update channel partner permissions
CREATE POLICY "Admins can update channel partner permissions"
  ON channel_partner_permissions
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

-- Only admins can delete channel partner permissions
CREATE POLICY "Admins can delete channel partner permissions"
  ON channel_partner_permissions
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
CREATE OR REPLACE FUNCTION update_channel_partner_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER set_channel_partner_permissions_updated_at
  BEFORE UPDATE ON channel_partner_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_channel_partner_permissions_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_channel_partner_permissions_channel_partner_id 
  ON channel_partner_permissions(channel_partner_id);
CREATE INDEX IF NOT EXISTS idx_channel_partner_permissions_user_id 
  ON channel_partner_permissions(user_id);

-- Add comments for documentation
COMMENT ON TABLE channel_partner_permissions IS 'Granular access control for channel partners';
COMMENT ON COLUMN channel_partner_permissions.can_view IS 'User can view this channel partner';
COMMENT ON COLUMN channel_partner_permissions.can_edit IS 'User can edit this channel partner';
