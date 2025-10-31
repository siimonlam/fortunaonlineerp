/*
  # Create Client as separate project type and restructure

  1. Changes
    - Add "Client" as a new project type
    - Remove "Client" status from Funding Project statuses
    - Add client_id reference to projects table for linking clients to projects
    - Make title optional for client records

  2. New Structure
    - Client is now a top-level section
    - Projects can be created from clients and linked back via client_id
*/

-- Add Client as a project type
INSERT INTO project_types (name)
VALUES ('Client')
ON CONFLICT DO NOTHING
RETURNING id;

-- Store the client project type id for use
DO $$
DECLARE
  client_type_id uuid;
BEGIN
  SELECT id INTO client_type_id FROM project_types WHERE name = 'Client';
  
  -- Add a status for Client project type
  INSERT INTO statuses (name, order_index, project_type_id)
  VALUES ('Active', 0, client_type_id)
  ON CONFLICT DO NOTHING;
END $$;

-- Remove Client status from Funding Project
DELETE FROM statuses 
WHERE name = 'Client' 
AND project_type_id = (SELECT id FROM project_types WHERE name = 'Funding Project');

-- Alter projects table to allow null title (for clients)
ALTER TABLE projects 
ALTER COLUMN title DROP NOT NULL;

-- Add default empty string for title
ALTER TABLE projects 
ALTER COLUMN title SET DEFAULT '';

-- Add a reference field to link projects back to their source client
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS source_client_id uuid REFERENCES projects(id);
