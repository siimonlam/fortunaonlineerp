/*
  # Fix infinite recursion in client access policies

  1. Problem
    - clients SELECT policy references client_access table
    - client_access SELECT policy references clients table
    - This creates circular dependency causing infinite recursion

  2. Solution
    - Remove the circular reference from client_access policies
    - Allow users to view client_access entries only for their own user_id
    - Keep the clients policy that checks client_access (one-way reference)

  3. Security
    - Users can only see client_access records where they are the user_id
    - Creators and sales persons can still manage access through INSERT/DELETE policies
*/

-- Drop existing client_access SELECT policy that causes recursion
DROP POLICY IF EXISTS "Users can view client access for accessible clients" ON client_access;

-- Simple policy: users can only see their own access grants
CREATE POLICY "Users can view their own client access"
  ON client_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
