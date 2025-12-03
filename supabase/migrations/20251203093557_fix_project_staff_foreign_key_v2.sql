/*
  # Fix project_staff foreign key relationship

  1. Changes
    - Clean up orphaned project_staff records that reference non-existent projects
    - Add missing foreign key constraint from project_staff.project_id to projects.id
    - This allows Supabase PostgREST to recognize the relationship for nested queries

  2. Security
    - No changes to RLS policies
*/

-- First, delete orphaned project_staff records
DELETE FROM project_staff
WHERE project_id NOT IN (SELECT id FROM projects);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_staff_project_id_fkey' 
    AND table_name = 'project_staff'
  ) THEN
    ALTER TABLE project_staff
    ADD CONSTRAINT project_staff_project_id_fkey
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE;
  END IF;
END $$;
