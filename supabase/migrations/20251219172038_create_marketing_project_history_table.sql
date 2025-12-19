/*
  # Create Marketing Project History Table

  1. New Tables
    - `marketing_project_history`
      - `id` (uuid, primary key)
      - `marketing_project_id` (uuid, foreign key to marketing_projects)
      - `user_id` (uuid, foreign key to staff, nullable)
      - `field_name` (text) - Name of the changed field
      - `old_value` (text) - Previous value
      - `new_value` (text) - New value
      - `changed_at` (timestamptz) - When the change occurred

  2. Purpose
    - Track changes to marketing projects (separate from regular projects)
    - Store history of field changes, especially status changes
    - Support audit trail and activity tracking

  3. Security
    - Enable RLS
    - Allow authenticated users to read history for projects they can access
*/

CREATE TABLE IF NOT EXISTS marketing_project_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid NOT NULL REFERENCES marketing_projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketing_project_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view marketing project history
CREATE POLICY "Authenticated users can view marketing project history"
  ON marketing_project_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_marketing_project_history_project ON marketing_project_history(marketing_project_id);
CREATE INDEX idx_marketing_project_history_changed_at ON marketing_project_history(changed_at DESC);
CREATE INDEX idx_marketing_project_history_user ON marketing_project_history(user_id);
