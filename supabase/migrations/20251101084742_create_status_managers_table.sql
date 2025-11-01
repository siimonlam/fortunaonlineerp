/*
  # Create Status Managers System

  1. New Tables
    - `status_managers`
      - `id` (uuid, primary key)
      - `status_id` (uuid, references statuses)
      - `user_id` (uuid, references staff)
      - `assigned_by` (uuid, references staff)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on status_managers table
    - Add policies for admin users to manage status managers
    - Add policies for all users to view status managers

  3. Notes
    - Multiple users can be assigned as managers for the same status
    - Status managers will be displayed on project cards in that status
*/

-- Create status_managers table
CREATE TABLE IF NOT EXISTS status_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid REFERENCES statuses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid REFERENCES staff(id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(status_id, user_id)
);

-- Enable RLS
ALTER TABLE status_managers ENABLE ROW LEVEL SECURITY;

-- Admins can manage status managers
CREATE POLICY "Admins can insert status managers"
  ON status_managers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update status managers"
  ON status_managers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete status managers"
  ON status_managers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- All authenticated users can view status managers
CREATE POLICY "Users can view status managers"
  ON status_managers
  FOR SELECT
  TO authenticated
  USING (true);

-- Enable realtime for status_managers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'status_managers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE status_managers;
  END IF;
END $$;