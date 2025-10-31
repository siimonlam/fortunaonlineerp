/*
  # Add User Roles and Permissions System

  1. New Tables
    - `user_roles`
      - `user_id` (uuid, references auth.users)
      - `role` (text, either 'admin' or 'user')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `client_permissions` 
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients)
      - `user_id` (uuid, references auth.users)
      - `can_view` (boolean)
      - `can_edit` (boolean)
      - `granted_by` (uuid, references auth.users)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both new tables
    - Admins can manage all permissions
    - Users can view their own role
    - Creators and sales persons automatically have full access
    
  3. Changes to Existing Tables
    - Update clients RLS policies to check user_roles for admin access
    - Update clients RLS policies to check client_permissions for view/edit access
    - Restrict delete operations to admins only

  4. Helper Functions
    - `is_admin(user_id uuid)` - Check if a user is an admin
    - `can_view_client(client_id uuid, user_id uuid)` - Check if user can view client
    - `can_edit_client(client_id uuid, user_id uuid)` - Check if user can edit client
*/

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create client_permissions table
CREATE TABLE IF NOT EXISTS client_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, user_id)
);

ALTER TABLE client_permissions ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = check_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user can view client
CREATE OR REPLACE FUNCTION can_view_client(check_client_id uuid, check_user_id uuid)
RETURNS boolean AS $$
DECLARE
  client_record RECORD;
BEGIN
  -- Get client info
  SELECT created_by, sales_person_id INTO client_record
  FROM clients WHERE id = check_client_id;
  
  -- Admin can view all
  IF is_admin(check_user_id) THEN
    RETURN true;
  END IF;
  
  -- Creator can view
  IF client_record.created_by = check_user_id THEN
    RETURN true;
  END IF;
  
  -- Sales person can view
  IF client_record.sales_person_id = check_user_id THEN
    RETURN true;
  END IF;
  
  -- Check explicit permissions
  RETURN EXISTS (
    SELECT 1 FROM client_permissions
    WHERE client_id = check_client_id 
      AND user_id = check_user_id 
      AND can_view = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user can edit client
CREATE OR REPLACE FUNCTION can_edit_client(check_client_id uuid, check_user_id uuid)
RETURNS boolean AS $$
DECLARE
  client_record RECORD;
BEGIN
  -- Get client info
  SELECT created_by, sales_person_id INTO client_record
  FROM clients WHERE id = check_client_id;
  
  -- Admin can edit all
  IF is_admin(check_user_id) THEN
    RETURN true;
  END IF;
  
  -- Creator can edit
  IF client_record.created_by = check_user_id THEN
    RETURN true;
  END IF;
  
  -- Sales person can edit
  IF client_record.sales_person_id = check_user_id THEN
    RETURN true;
  END IF;
  
  -- Check explicit permissions
  RETURN EXISTS (
    SELECT 1 FROM client_permissions
    WHERE client_id = check_client_id 
      AND user_id = check_user_id 
      AND can_edit = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage all roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for client_permissions
CREATE POLICY "Admins can manage all client permissions"
  ON client_permissions FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Creators can manage permissions for their clients"
  ON client_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE id = client_permissions.client_id 
        AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE id = client_permissions.client_id 
        AND created_by = auth.uid()
    )
  );

CREATE POLICY "Sales persons can manage permissions for their clients"
  ON client_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE id = client_permissions.client_id 
        AND sales_person_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE id = client_permissions.client_id 
        AND sales_person_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own permissions"
  ON client_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Drop old client policies
DROP POLICY IF EXISTS "Users can view accessible clients" ON clients;
DROP POLICY IF EXISTS "Creators and sales persons can update clients" ON clients;
DROP POLICY IF EXISTS "Creators and sales persons can delete clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can create clients" ON clients;

-- New client policies
CREATE POLICY "Users can view clients they have access to"
  ON clients FOR SELECT
  TO authenticated
  USING (can_view_client(id, auth.uid()));

CREATE POLICY "Users can edit clients they have access to"
  ON clients FOR UPDATE
  TO authenticated
  USING (can_edit_client(id, auth.uid()))
  WITH CHECK (can_edit_client(id, auth.uid()));

CREATE POLICY "All authenticated users can create clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Only admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Similarly update projects delete policy
DROP POLICY IF EXISTS "Users can delete own projects or assigned projects" ON projects;

CREATE POLICY "Only admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Drop the old client_access table if it exists (replaced by client_permissions)
DROP TABLE IF EXISTS client_access CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_client_permissions_client_id ON client_permissions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_permissions_user_id ON client_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_client_permissions_lookup ON client_permissions(client_id, user_id);
