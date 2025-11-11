/*
  # Add Project Reference Number to Projects

  1. Changes to projects table
    - Add `project_reference` column with FP prefix for Funding Projects (e.g., FP00001)
    - Create sequence for auto-incrementing project numbers
    - Generate reference numbers for existing funding projects
    
  2. Purpose
    - Each funding project gets a unique reference number starting with "FP"
    - Sequential numbering FP00001, FP00002, etc.
    - Auto-generated for new funding projects

  3. Security
    - No RLS changes needed, inherits existing policies
*/

-- Create sequence for project reference numbers
CREATE SEQUENCE IF NOT EXISTS project_reference_seq START 1;

-- Add project_reference column to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_reference'
  ) THEN
    ALTER TABLE projects ADD COLUMN project_reference text UNIQUE;
  END IF;
END $$;

-- Generate reference numbers for existing funding projects (ordered by created_at)
DO $$
DECLARE
  project_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR project_record IN 
    SELECT p.id 
    FROM projects p
    JOIN project_types pt ON p.project_type_id = pt.id
    WHERE pt.name = 'Funding Project' 
    AND p.project_reference IS NULL
    ORDER BY p.created_at
  LOOP
    UPDATE projects 
    SET project_reference = 'FP' || LPAD(counter::text, 5, '0')
    WHERE id = project_record.id;
    counter := counter + 1;
  END LOOP;
  
  -- Update the sequence to start from the next number
  PERFORM setval('project_reference_seq', counter);
END $$;

-- Create function to auto-generate project reference for new funding projects
CREATE OR REPLACE FUNCTION generate_project_reference()
RETURNS TRIGGER AS $$
DECLARE
  project_type_name text;
BEGIN
  -- Get the project type name
  SELECT name INTO project_type_name
  FROM project_types
  WHERE id = NEW.project_type_id;
  
  -- Only generate reference for Funding Projects
  IF project_type_name = 'Funding Project' AND NEW.project_reference IS NULL THEN
    NEW.project_reference := 'FP' || LPAD(nextval('project_reference_seq')::text, 5, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generation
DROP TRIGGER IF EXISTS set_project_reference ON projects;
CREATE TRIGGER set_project_reference
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION generate_project_reference();

-- Create index for project_reference
CREATE INDEX IF NOT EXISTS idx_projects_project_reference ON projects(project_reference);

-- Add comment for documentation
COMMENT ON COLUMN projects.project_reference IS 'Unique reference number for funding projects (e.g., FP00001)';
