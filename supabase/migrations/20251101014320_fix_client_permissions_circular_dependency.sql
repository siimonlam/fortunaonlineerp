/*
  # Fix Client Permissions Circular Dependency

  1. Problem
    - clients SELECT policy queries client_permissions table
    - client_permissions policies query clients table
    - This creates infinite recursion when both have RLS enabled
    
  2. Solution
    - Create SECURITY DEFINER functions to check client ownership
    - These functions bypass RLS to prevent circular dependencies
    - Update client_permissions policies to use these functions
    
  3. Changes
    - Create check_client_creator() and check_client_sales_person() functions
    - Recreate all client_permissions policies using these functions
*/

-- Create security definer functions to check client relationships without triggering RLS
CREATE OR REPLACE FUNCTION check_client_creator(client_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM clients 
    WHERE id = client_id_param AND created_by = user_id_param
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_client_sales_person(client_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM clients 
    WHERE id = client_id_param AND sales_person_id = user_id_param
  );
END;
$$;

-- Drop existing client_permissions policies
DROP POLICY IF EXISTS "Users can view their own permissions" ON client_permissions;
DROP POLICY IF EXISTS "Creators can manage permissions for their clients" ON client_permissions;
DROP POLICY IF EXISTS "Sales persons can manage permissions for their clients" ON client_permissions;
DROP POLICY IF EXISTS "Admins can manage all client permissions" ON client_permissions;

-- Recreate policies using security definer functions
CREATE POLICY "Users can view their own permissions"
  ON client_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Creators can manage permissions for their clients"
  ON client_permissions
  FOR ALL
  TO authenticated
  USING (check_client_creator(client_id, auth.uid()))
  WITH CHECK (check_client_creator(client_id, auth.uid()));

CREATE POLICY "Sales persons can manage permissions for their clients"
  ON client_permissions
  FOR ALL
  TO authenticated
  USING (check_client_sales_person(client_id, auth.uid()))
  WITH CHECK (check_client_sales_person(client_id, auth.uid()));

CREATE POLICY "Admins can manage all client permissions"
  ON client_permissions
  FOR ALL
  TO authenticated
  USING (check_is_admin(auth.uid()))
  WITH CHECK (check_is_admin(auth.uid()));
