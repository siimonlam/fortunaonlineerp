/*
  # Create Marketing Project Buttons Table

  1. New Tables
    - `marketing_project_buttons`
      - `id` (uuid, primary key)
      - `name` (text) - The name of the button
      - `marketing_project_id` (uuid) - References marketing_projects table
      - `display_order` (integer) - Order to display buttons
      - `created_by` (uuid) - User who created the button
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `marketing_project_buttons` table
    - Add policies for authenticated users to manage buttons
*/

CREATE TABLE IF NOT EXISTS marketing_project_buttons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  marketing_project_id uuid NOT NULL REFERENCES marketing_projects(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE marketing_project_buttons ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view buttons
CREATE POLICY "Authenticated users can view marketing project buttons"
  ON marketing_project_buttons
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to create buttons
CREATE POLICY "Authenticated users can create marketing project buttons"
  ON marketing_project_buttons
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own buttons
CREATE POLICY "Users can update their own marketing project buttons"
  ON marketing_project_buttons
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Allow users to delete their own buttons
CREATE POLICY "Users can delete their own marketing project buttons"
  ON marketing_project_buttons
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_marketing_project_buttons_project 
  ON marketing_project_buttons(marketing_project_id);

CREATE INDEX IF NOT EXISTS idx_marketing_project_buttons_order 
  ON marketing_project_buttons(display_order);
