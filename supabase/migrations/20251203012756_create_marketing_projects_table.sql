/*
  # Create Marketing Projects Table

  1. New Tables
    - `marketing_projects`
      - `id` (uuid, primary key)
      - `title` (text) - Project title
      - `description` (text, nullable) - Project description
      - `status_id` (uuid, foreign key) - Current status (references statuses table)
      - `created_by` (uuid, foreign key) - Staff who created project
      - `client_id` (uuid, foreign key, nullable) - Reference to clients table
      - `company_name` (text, nullable) - Company name
      - `company_name_chinese` (text, nullable) - Company name in Chinese
      - `contact_name` (text, nullable) - Contact person name
      - `contact_number` (text, nullable) - Contact phone number
      - `email` (text, nullable) - Contact email
      - `address` (text, nullable) - Company address
      - `sales_person_id` (uuid, foreign key, nullable) - Sales person reference
      - `sales_source` (text, nullable) - Source of the lead
      - `sales_source_detail` (text, nullable) - Detailed source information
      - `project_name` (text, nullable) - Specific project name
      - `google_drive_folder_id` (text, nullable) - Google Drive folder ID
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on marketing_projects table
    - Allow all authenticated users to view marketing projects (simplified for now)
    - Allow all authenticated users to create/update marketing projects

  3. Purpose
    - Separate marketing projects from funding projects
    - Cleaner data structure for different project types
    - Easier to manage marketing-specific fields
*/

-- Create marketing_projects table
CREATE TABLE IF NOT EXISTS marketing_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  status_id uuid NOT NULL REFERENCES statuses(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  company_name text,
  company_name_chinese text,
  contact_name text,
  contact_number text,
  email text,
  address text,
  sales_person_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  sales_source text,
  sales_source_detail text,
  project_name text,
  google_drive_folder_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE marketing_projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all authenticated users to access marketing projects
CREATE POLICY "Allow all authenticated users to view marketing projects"
  ON marketing_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all authenticated users to create marketing projects"
  ON marketing_projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update marketing projects"
  ON marketing_projects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to delete marketing projects"
  ON marketing_projects FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_projects_status_id ON marketing_projects(status_id);
CREATE INDEX IF NOT EXISTS idx_marketing_projects_created_by ON marketing_projects(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_projects_client_id ON marketing_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_marketing_projects_sales_person_id ON marketing_projects(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_marketing_projects_created_at ON marketing_projects(created_at DESC);

-- Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_projects;

-- Set replica identity to full for realtime updates
ALTER TABLE marketing_projects REPLICA IDENTITY FULL;
