/*
  # Migrate existing marketing project access to marketing_project_staff

  1. Changes
    - Populates marketing_project_staff with existing access relationships
    - created_by gets full edit access
    - sales_person_id gets full edit access (if different from creator)
    - Uses INSERT ... ON CONFLICT to prevent duplicates
*/

-- Add created_by users as staff with edit access
INSERT INTO marketing_project_staff (project_id, user_id, can_view, can_edit)
SELECT 
  id as project_id,
  created_by as user_id,
  true as can_view,
  true as can_edit
FROM marketing_projects
WHERE created_by IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Add sales_person_id users as staff with edit access (if different from creator)
INSERT INTO marketing_project_staff (project_id, user_id, can_view, can_edit)
SELECT 
  id as project_id,
  sales_person_id as user_id,
  true as can_view,
  true as can_edit
FROM marketing_projects
WHERE sales_person_id IS NOT NULL
  AND sales_person_id != created_by
ON CONFLICT (project_id, user_id) DO NOTHING;
