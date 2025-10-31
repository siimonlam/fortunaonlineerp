/*
  # Fix client_id data type in projects table

  1. Problem
    - client_id in projects is TEXT but should be UUID
    - This prevents foreign key relationships and joins
    
  2. Changes
    - Convert client_id from TEXT to UUID
    - Add foreign key constraint to clients table
    - Add index for better query performance
    
  3. Security
    - Maintain existing RLS policies
*/

-- First, clear any invalid data (non-UUID values)
UPDATE projects SET client_id = NULL WHERE client_id IS NOT NULL AND client_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Convert the column type from TEXT to UUID
ALTER TABLE projects 
ALTER COLUMN client_id TYPE uuid USING client_id::uuid;

-- Add foreign key constraint
ALTER TABLE projects
ADD CONSTRAINT fk_projects_client
FOREIGN KEY (client_id) 
REFERENCES clients(id)
ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
