/*
  # Grant All Staff Full Project Access
  
  1. Changes
    - Grant all existing staff members view and edit access to all project statuses
    - This ensures all users can see all projects regardless of status
    
  2. Security
    - Only grants access to authenticated staff members
    - Maintains existing RLS policies
*/

-- Grant all staff access to all Funding Project statuses
INSERT INTO status_permissions (user_id, status_id, can_view_all, can_edit_all, created_by)
SELECT 
  s.id as user_id,
  st.id as status_id,
  true as can_view_all,
  true as can_edit_all,
  s.id as created_by
FROM staff s
CROSS JOIN statuses st
WHERE st.project_type_id = '49c17e80-db14-4e13-b03f-537771270696' -- Funding Project type
ON CONFLICT (user_id, status_id) 
DO UPDATE SET 
  can_view_all = true,
  can_edit_all = true,
  updated_at = now();

-- Grant all staff access to all Com Sec statuses
INSERT INTO status_permissions (user_id, status_id, can_view_all, can_edit_all, created_by)
SELECT 
  s.id as user_id,
  st.id as status_id,
  true as can_view_all,
  true as can_edit_all,
  s.id as created_by
FROM staff s
CROSS JOIN statuses st
WHERE st.project_type_id = 'ca754beb-df54-45c1-a339-0e74790777d3' -- Com Sec type
ON CONFLICT (user_id, status_id) 
DO UPDATE SET 
  can_view_all = true,
  can_edit_all = true,
  updated_at = now();

-- Grant all staff access to all Marketing statuses
INSERT INTO status_permissions (user_id, status_id, can_view_all, can_edit_all, created_by)
SELECT 
  s.id as user_id,
  st.id as status_id,
  true as can_view_all,
  true as can_edit_all,
  s.id as created_by
FROM staff s
CROSS JOIN statuses st
WHERE st.project_type_id = '7c139574-9bb9-448a-98fc-f9f0c3bc1259' -- Marketing type
ON CONFLICT (user_id, status_id) 
DO UPDATE SET 
  can_view_all = true,
  can_edit_all = true,
  updated_at = now();
