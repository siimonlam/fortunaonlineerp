/*
  # Add INSERT policy for funding_clients table

  1. Changes
    - Add INSERT policy to allow authenticated users to create their own funding_clients record
    - This allows users who sign up via email/password or Google OAuth to create their profile

  2. Security
    - Users can only insert a record with their own auth.uid()
    - Prevents users from creating records for other users
*/

-- Allow authenticated users to insert their own funding_clients record
CREATE POLICY "Users can insert own funding client record"
  ON funding_clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
