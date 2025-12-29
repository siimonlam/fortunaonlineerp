/*
  # Add default status to projects table

  1. Changes
    - Set a default value for status_id in projects table
    - Uses "Cold Call" status as the default for new projects
  
  2. Notes
    - This allows CSV imports without requiring status_id
    - Existing projects are not affected
*/

-- Set default status_id to "Cold Call" for Funding Project type
ALTER TABLE projects 
ALTER COLUMN status_id 
SET DEFAULT '02240816-0fe9-4cde-bbf6-5abdfe398412';
