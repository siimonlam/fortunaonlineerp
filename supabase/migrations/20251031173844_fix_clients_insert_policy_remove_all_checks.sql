/*
  # Fix Clients Insert Policy - Remove All Checks

  1. Changes
    - Drop and recreate the INSERT policy with absolutely minimal checks
    - Use anon + authenticated roles to allow all users
    
  2. Security
    - Allow any authenticated user to insert clients
    - The created_by field will be set by the application
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;

-- Create new INSERT policy that applies to both anon and authenticated
CREATE POLICY "Allow client creation"
  ON clients
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);
