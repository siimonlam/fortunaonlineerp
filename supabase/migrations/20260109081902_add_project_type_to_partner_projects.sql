/*
  # Add Project Type and Status to Partner Projects

  1. Changes
    - Add `project_type` column to partner_projects (audit, marketing, production, website, others)
    - Add `project_status` column to track project status (pending, in_progress, completed, cancelled)
    - Add default values for both fields
    
  2. Purpose
    - Enable categorization of partner projects by type
    - Track the status of each project
    - Support filtering and reporting by project type and status
*/

-- Add project_type column with enum constraint
ALTER TABLE partner_projects
ADD COLUMN IF NOT EXISTS project_type text DEFAULT 'others';

-- Add check constraint for valid project types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'partner_projects_project_type_check'
  ) THEN
    ALTER TABLE partner_projects
    ADD CONSTRAINT partner_projects_project_type_check
    CHECK (project_type IN ('audit', 'marketing', 'production', 'website', 'others'));
  END IF;
END $$;

-- Add project_status column with enum constraint
ALTER TABLE partner_projects
ADD COLUMN IF NOT EXISTS project_status text DEFAULT 'pending';

-- Add check constraint for valid project statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'partner_projects_project_status_check'
  ) THEN
    ALTER TABLE partner_projects
    ADD CONSTRAINT partner_projects_project_status_check
    CHECK (project_status IN ('pending', 'in_progress', 'completed', 'cancelled'));
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_partner_projects_project_type 
  ON partner_projects(project_type);

CREATE INDEX IF NOT EXISTS idx_partner_projects_project_status 
  ON partner_projects(project_status);

-- Add comments for documentation
COMMENT ON COLUMN partner_projects.project_type IS 'Type of project: audit, marketing, production, website, or others';
COMMENT ON COLUMN partner_projects.project_status IS 'Current status of the project: pending, in_progress, completed, or cancelled';