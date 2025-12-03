/*
  # Create marketing_project_staff table for staff sharing

  1. New Tables
    - `marketing_project_staff`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to marketing_projects)
      - `user_id` (uuid, foreign key to staff)
      - `can_view` (boolean, default true)
      - `can_edit` (boolean, default false)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `marketing_project_staff` table
    - Add policies for viewing and managing staff assignments
    - Staff can view their own assignments
    - Project creators, sales persons, and admins can manage assignments

  3. Changes
    - Enables staff sharing for marketing projects
    - Mirrors the structure of `project_staff` table
*/

CREATE TABLE IF NOT EXISTS marketing_project_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES marketing_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE marketing_project_staff ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own assignments
CREATE POLICY "Users can view their own marketing project assignments"
  ON marketing_project_staff
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT created_by FROM marketing_projects WHERE id = project_id
    )
    OR auth.uid() IN (
      SELECT sales_person_id FROM marketing_projects WHERE id = project_id
    )
    OR is_admin(auth.uid())
  );

-- Project creators, sales persons, and admins can add staff to marketing projects
CREATE POLICY "Authorized users can add staff to marketing projects"
  ON marketing_project_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT created_by FROM marketing_projects WHERE id = project_id
    )
    OR auth.uid() IN (
      SELECT sales_person_id FROM marketing_projects WHERE id = project_id
    )
    OR is_admin(auth.uid())
  );

-- Project creators, sales persons, and admins can update staff assignments
CREATE POLICY "Authorized users can update marketing project staff"
  ON marketing_project_staff
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT created_by FROM marketing_projects WHERE id = project_id
    )
    OR auth.uid() IN (
      SELECT sales_person_id FROM marketing_projects WHERE id = project_id
    )
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT created_by FROM marketing_projects WHERE id = project_id
    )
    OR auth.uid() IN (
      SELECT sales_person_id FROM marketing_projects WHERE id = project_id
    )
    OR is_admin(auth.uid())
  );

-- Project creators, sales persons, and admins can remove staff assignments
CREATE POLICY "Authorized users can delete marketing project staff"
  ON marketing_project_staff
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT created_by FROM marketing_projects WHERE id = project_id
    )
    OR auth.uid() IN (
      SELECT sales_person_id FROM marketing_projects WHERE id = project_id
    )
    OR is_admin(auth.uid())
  );

-- Enable realtime for marketing_project_staff
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_project_staff;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_marketing_project_staff_project_id ON marketing_project_staff(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_project_staff_user_id ON marketing_project_staff(user_id);
