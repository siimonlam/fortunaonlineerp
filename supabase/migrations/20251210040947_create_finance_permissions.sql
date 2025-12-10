/*
  # Create Finance Permissions Table

  1. New Tables
    - `finance_permissions`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Foreign key to staff
      - `created_at` (timestamptz)
      
  2. Purpose
    - Control which users can access invoice actions (Mark Paid, Void, Delete)
    - Admins always have access
    - Users with finance permission can perform these actions
    
  3. Security
    - Enable RLS on finance_permissions
    - Admin users can manage permissions
    - All users can view their own permissions
*/

-- Create finance_permissions table
CREATE TABLE IF NOT EXISTS finance_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE finance_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can view all permissions
CREATE POLICY "Admins can view all finance permissions"
  ON finance_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can view their own permissions
CREATE POLICY "Users can view own finance permissions"
  ON finance_permissions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Admins can insert permissions
CREATE POLICY "Admins can insert finance permissions"
  ON finance_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admins can delete permissions
CREATE POLICY "Admins can delete finance permissions"
  ON finance_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_finance_permissions_user_id 
  ON finance_permissions(user_id);
