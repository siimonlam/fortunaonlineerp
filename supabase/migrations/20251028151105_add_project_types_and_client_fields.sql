/*
  # Add project types and client fields

  1. New Tables
    - `project_types`
      - `id` (uuid, primary key)
      - `name` (text, unique) - "Funding Project" or "Marketing"
      - `created_at` (timestamp)

  2. Changes to Existing Tables
    - `projects`
      - Add `project_type_id` (uuid, references project_types)
      - Add client-specific fields:
        - `client_id` (text) - Client identifier
        - `company_name` (text)
        - `contact_name` (text)
        - `contact_number` (text)
        - `email` (text)
        - `address` (text)
        - `lead_source` (text)
        - `sales_person` (text)
        - `upload_link` (text)
    
    - `statuses`
      - Add `project_type_id` (uuid, nullable) - links status to project type
      - Add new "Client" status for Funding projects

  3. Security
    - Enable RLS on `project_types` table
    - Add policies for authenticated users to read project types
    - Update existing policies to work with new structure

  4. Data Migration
    - Insert default project types: "Funding Project" and "Marketing"
    - Insert "Client" status for Funding projects
    - Link existing statuses to Funding project type
    - Set all existing projects to "Funding Project" type by default
*/

-- Create project_types table
CREATE TABLE IF NOT EXISTS project_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view project types"
  ON project_types
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert default project types
INSERT INTO project_types (name) VALUES ('Funding Project'), ('Marketing')
ON CONFLICT (name) DO NOTHING;

-- Add project_type_id to statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'statuses' AND column_name = 'project_type_id'
  ) THEN
    ALTER TABLE statuses ADD COLUMN project_type_id uuid REFERENCES project_types(id);
  END IF;
END $$;

-- Link existing statuses to Funding Project
UPDATE statuses 
SET project_type_id = (SELECT id FROM project_types WHERE name = 'Funding Project')
WHERE project_type_id IS NULL;

-- Insert Client status for Funding projects
INSERT INTO statuses (name, order_index, project_type_id)
SELECT 'Client', 0, id FROM project_types WHERE name = 'Funding Project'
ON CONFLICT (name) DO NOTHING;

-- Update order_index for existing statuses (shift them up)
UPDATE statuses SET order_index = order_index + 1 
WHERE name IN ('Hi-Po', 'Pre-submission', 'Approved');

-- Add columns to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_type_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN project_type_id uuid REFERENCES project_types(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN client_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE projects ADD COLUMN company_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'contact_name'
  ) THEN
    ALTER TABLE projects ADD COLUMN contact_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'contact_number'
  ) THEN
    ALTER TABLE projects ADD COLUMN contact_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'email'
  ) THEN
    ALTER TABLE projects ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'address'
  ) THEN
    ALTER TABLE projects ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'lead_source'
  ) THEN
    ALTER TABLE projects ADD COLUMN lead_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'sales_person'
  ) THEN
    ALTER TABLE projects ADD COLUMN sales_person text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'upload_link'
  ) THEN
    ALTER TABLE projects ADD COLUMN upload_link text;
  END IF;
END $$;

-- Set existing projects to Funding Project type
UPDATE projects 
SET project_type_id = (SELECT id FROM project_types WHERE name = 'Funding Project')
WHERE project_type_id IS NULL;
