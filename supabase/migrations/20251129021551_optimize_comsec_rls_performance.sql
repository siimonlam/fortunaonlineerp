/*
  # Optimize ComSec RLS Performance

  1. Performance Improvements
    - Add composite indexes for comsec RLS policy checks
    - These will speed up the admin and project type permission lookups

  2. Indexes Added
    - user_roles: composite index on (user_id, role) for fast admin checks
    - project_types: index on name for Com Sec lookups
*/

-- Composite index for fast admin role checks
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON user_roles(user_id, role) 
WHERE role = 'admin';

-- Index for project type name lookups (Com Sec, Funding, Marketing)
CREATE INDEX IF NOT EXISTS idx_project_types_name 
ON project_types(name);

-- Composite index for project_type_permissions with user_id
CREATE INDEX IF NOT EXISTS idx_ptp_user_project_type 
ON project_type_permissions(user_id, project_type_id);
