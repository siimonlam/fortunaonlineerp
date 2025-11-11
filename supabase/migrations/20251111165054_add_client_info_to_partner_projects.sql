/*
  # Add Client Information to Partner Projects

  1. Changes to partner_projects table
    - Add `company_name` (text) - Company/client name
    - Add `client_id` (uuid) - Foreign key reference to clients table
    
  2. Purpose
    - Link partner projects to client records
    - Display company information in partner project listings
    
  3. Security
    - No RLS changes needed, inherits existing policies
*/

-- Add client information columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_projects' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE partner_projects ADD COLUMN company_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_projects' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE partner_projects ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for client_id
CREATE INDEX IF NOT EXISTS idx_partner_projects_client_id 
  ON partner_projects(client_id);

-- Add comments for documentation
COMMENT ON COLUMN partner_projects.company_name IS 'Company/client name for the project';
COMMENT ON COLUMN partner_projects.client_id IS 'Reference to the client record';
