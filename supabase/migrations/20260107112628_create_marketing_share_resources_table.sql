/*
  # Create Marketing Share Resources Table

  1. New Tables
    - `marketing_share_resources`
      - `id` (uuid, primary key)
      - `marketing_project_id` (uuid, foreign key to marketing_projects)
      - `title` (text, resource title)
      - `content` (text, resource content/description)
      - `resource_type` (text, type: text/image/link/file/email)
      - `image_url` (text, URL for image resources)
      - `external_url` (text, URL for link resources)
      - `file_path` (text, storage path for file resources)
      - `file_name` (text, original file name)
      - `file_size` (bigint, file size in bytes)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on marketing_share_resources
    - Allow marketing project staff to view/create/edit/delete resources
    - Resources are scoped to specific marketing projects

  3. Indexes
    - Index on marketing_project_id for fast lookups
    - Index on created_at for chronological sorting
*/

-- Create marketing_share_resources table
CREATE TABLE IF NOT EXISTS marketing_share_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid NOT NULL REFERENCES marketing_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text DEFAULT '',
  resource_type text NOT NULL CHECK (resource_type IN ('text', 'image', 'link', 'file', 'email')),
  image_url text,
  external_url text,
  file_path text,
  file_name text,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketing_share_resources_project_id ON marketing_share_resources(marketing_project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_share_resources_created_at ON marketing_share_resources(created_at DESC);

-- Enable RLS
ALTER TABLE marketing_share_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketing_share_resources
CREATE POLICY "Users can view resources for marketing projects they have access to"
  ON marketing_share_resources
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Marketing project staff can create resources"
  ON marketing_share_resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Marketing project staff can update resources"
  ON marketing_share_resources
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Marketing project staff can delete resources"
  ON marketing_share_resources
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_share_resources.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_share_resources;
