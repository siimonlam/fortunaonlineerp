/*
  # Create Marketing Authorization Table

  1. New Tables
    - `marketing_authorization`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `created_at` (timestamp)
      - `created_by` (uuid, foreign key to auth.users)
  
  2. Security
    - Enable RLS on `marketing_authorization` table
    - Admin can view all records
    - Admin can insert/update/delete records
    - Users can view their own authorization status
*/

-- Create marketing_authorization table
CREATE TABLE IF NOT EXISTS marketing_authorization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add unique constraint to prevent duplicate authorizations
CREATE UNIQUE INDEX IF NOT EXISTS marketing_authorization_user_id_key ON marketing_authorization(user_id);

-- Enable RLS
ALTER TABLE marketing_authorization ENABLE ROW LEVEL SECURITY;

-- Admin can view all marketing authorizations
CREATE POLICY "Admins can view all marketing authorizations"
  ON marketing_authorization
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users can view their own marketing authorization
CREATE POLICY "Users can view own marketing authorization"
  ON marketing_authorization
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin can insert marketing authorizations
CREATE POLICY "Admins can insert marketing authorizations"
  ON marketing_authorization
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admin can delete marketing authorizations
CREATE POLICY "Admins can delete marketing authorizations"
  ON marketing_authorization
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );