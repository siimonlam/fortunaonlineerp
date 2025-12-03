/*
  # Allow project_staff to Reference Marketing Projects

  1. Changes
    - Drop foreign key constraint from project_staff.project_id to projects.id
    - This allows project_staff to reference both projects and marketing_projects
    - Add trigger for marketing_projects to auto-assign creator
    - Backfill existing marketing projects

  2. Security
    - RLS policies still protect data access
    - Application logic ensures project_id references valid projects
*/

-- Drop the foreign key constraint from project_staff.project_id
ALTER TABLE project_staff 
DROP CONSTRAINT IF EXISTS project_staff_project_id_fkey;

-- Create trigger for marketing_projects table
DROP TRIGGER IF EXISTS assign_creator_trigger_marketing ON marketing_projects;
CREATE TRIGGER assign_creator_trigger_marketing
AFTER INSERT ON marketing_projects
FOR EACH ROW
EXECUTE FUNCTION assign_creator_to_project();

-- Fix existing marketing projects by adding missing project_staff entries
INSERT INTO project_staff (project_id, staff_id, user_id, can_view, can_edit)
SELECT 
  mp.id as project_id,
  mp.created_by as staff_id,
  mp.created_by as user_id,
  true as can_view,
  true as can_edit
FROM marketing_projects mp
LEFT JOIN project_staff ps ON ps.project_id = mp.id AND ps.staff_id = mp.created_by
WHERE ps.id IS NULL AND mp.created_by IS NOT NULL
ON CONFLICT (project_id, staff_id) DO NOTHING;
