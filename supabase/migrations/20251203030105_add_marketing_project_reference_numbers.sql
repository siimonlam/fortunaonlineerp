/*
  # Add Project Reference Numbers to Marketing Projects

  1. Changes to marketing_projects table
    - Add `project_reference` column with MP prefix (e.g., MP0001)
    - Create sequence for auto-incrementing marketing project numbers
    - Generate reference numbers for existing marketing projects starting from MP0001
    
  2. Purpose
    - Each marketing project gets a unique reference number starting with "MP"
    - Sequential numbering MP0001, MP0002, etc.
    - Auto-generated for new marketing projects

  3. Security
    - No RLS changes needed, inherits existing policies
*/

-- Create sequence for marketing project reference numbers
CREATE SEQUENCE IF NOT EXISTS marketing_project_reference_seq START 1;

-- Add project_reference column to marketing_projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_projects' AND column_name = 'project_reference'
  ) THEN
    ALTER TABLE marketing_projects ADD COLUMN project_reference text UNIQUE;
  END IF;
END $$;

-- Generate reference numbers for existing marketing projects (ordered by created_at)
DO $$
DECLARE
  project_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR project_record IN 
    SELECT id 
    FROM marketing_projects
    WHERE project_reference IS NULL
    ORDER BY created_at
  LOOP
    UPDATE marketing_projects 
    SET project_reference = 'MP' || LPAD(counter::text, 4, '0')
    WHERE id = project_record.id;
    counter := counter + 1;
  END LOOP;
  
  -- Update the sequence to start from the next number
  PERFORM setval('marketing_project_reference_seq', counter);
END $$;

-- Create function to auto-generate marketing project reference
CREATE OR REPLACE FUNCTION generate_marketing_project_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate reference for new marketing projects if not provided
  IF NEW.project_reference IS NULL THEN
    NEW.project_reference := 'MP' || LPAD(nextval('marketing_project_reference_seq')::text, 4, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generation
DROP TRIGGER IF EXISTS set_marketing_project_reference ON marketing_projects;
CREATE TRIGGER set_marketing_project_reference
  BEFORE INSERT ON marketing_projects
  FOR EACH ROW
  EXECUTE FUNCTION generate_marketing_project_reference();

-- Create index for project_reference
CREATE INDEX IF NOT EXISTS idx_marketing_projects_project_reference ON marketing_projects(project_reference);

-- Add comment for documentation
COMMENT ON COLUMN marketing_projects.project_reference IS 'Unique reference number for marketing projects (e.g., MP0001)';
