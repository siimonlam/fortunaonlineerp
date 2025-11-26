/*
  # Add Parent Account Fields to Tables

  1. New Columns
    - Add `parent_client_id` and `parent_company_name` to:
      - clients table (name is the company name)
      - projects table (company_name exists)
      - comsec_clients table (company_name exists)
    
  2. Default Values
    - Set parent_client_id = client_number for existing clients
    - Set parent_company_name = name for existing clients
    - Set parent_company_name = company_name for projects and comsec
    - For projects, get parent_client_id from linked client

  3. Notes
    - parent_client_id stores the client number (text format like '0007')
    - This allows grouping related companies under a parent company
*/

-- Add columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_client_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_company_name text;

-- Add columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_client_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_company_name text;

-- Add columns to comsec_clients table
ALTER TABLE comsec_clients ADD COLUMN IF NOT EXISTS parent_client_id text;
ALTER TABLE comsec_clients ADD COLUMN IF NOT EXISTS parent_company_name text;

-- Set default values for existing records in clients table
UPDATE clients 
SET parent_client_id = client_number,
    parent_company_name = name
WHERE parent_client_id IS NULL;

-- Set default values for existing records in projects table
-- First, try to get from the related client
UPDATE projects p
SET parent_client_id = c.client_number,
    parent_company_name = p.company_name
FROM clients c
WHERE p.client_id = c.id
  AND p.parent_client_id IS NULL;

-- For projects without a linked client, just use company_name
UPDATE projects 
SET parent_company_name = company_name
WHERE parent_company_name IS NULL;

-- Set default values for existing records in comsec_clients table
UPDATE comsec_clients 
SET parent_client_id = client_id,
    parent_company_name = company_name
WHERE parent_client_id IS NULL;