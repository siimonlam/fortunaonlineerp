/*
  # Make created_by nullable for CSV imports

  1. Changes
    - Change created_by column to nullable in projects table
  
  2. Notes
    - This allows CSV imports without requiring created_by
    - Projects created through the app will still have created_by set
    - Existing projects are not affected
*/

-- Make created_by nullable to allow CSV imports
ALTER TABLE projects 
ALTER COLUMN created_by DROP NOT NULL;
