/*
  # Create Marketing Button Visibility Permissions

  1. New Tables
    - `marketing_button_staff` - Controls which users can see which buttons
      - `id` (uuid, primary key)
      - `button_id` (uuid) - References marketing_project_buttons
      - `user_id` (uuid) - References auth.users
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `marketing_button_staff` table
    - Only admins can manage button visibility
    - Users can query their own button access

  3. Notes
    - If no records exist for a button, all users can see it (default visible)
    - If records exist, only specified users can see the button
*/

-- Create marketing_button_staff table
CREATE TABLE IF NOT EXISTS marketing_button_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  button_id uuid NOT NULL REFERENCES marketing_project_buttons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(button_id, user_id)
);

-- Enable RLS
ALTER TABLE marketing_button_staff ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view button permissions (to check their own access)
CREATE POLICY "Authenticated users can view button permissions"
  ON marketing_button_staff
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage button permissions
CREATE POLICY "Admins can insert button permissions"
  ON marketing_button_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete button permissions"
  ON marketing_button_staff
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_button_staff_button 
  ON marketing_button_staff(button_id);

CREATE INDEX IF NOT EXISTS idx_marketing_button_staff_user 
  ON marketing_button_staff(user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_button_staff;
