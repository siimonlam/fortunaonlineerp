/*
  # Add Performance Indexes for RLS

  1. Performance Improvements
    - Add indexes on foreign keys used in RLS policies
    - Add composite indexes for permission lookups
    - These will dramatically speed up permission checks

  2. Indexes Added
    - project_permissions (user_id, project_id, can_view, can_edit)
    - project_assignments (user_id, project_id, can_view, can_edit)
    - status_permissions (user_id, status_id)
    - projects (status_id, created_by, sales_person_id)
    - client_permissions (user_id, client_id)
*/

-- Add indexes for project_permissions
CREATE INDEX IF NOT EXISTS idx_project_permissions_user_project 
ON project_permissions(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_project_permissions_user_view 
ON project_permissions(user_id, can_view) WHERE can_view = true;

CREATE INDEX IF NOT EXISTS idx_project_permissions_user_edit 
ON project_permissions(user_id, can_edit) WHERE can_edit = true;

-- Add indexes for project_assignments
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_project 
ON project_assignments(user_id, project_id);

-- Add indexes for status_permissions
CREATE INDEX IF NOT EXISTS idx_status_permissions_user_status 
ON status_permissions(user_id, status_id);

CREATE INDEX IF NOT EXISTS idx_status_permissions_view 
ON status_permissions(user_id, can_view_all) WHERE can_view_all = true;

CREATE INDEX IF NOT EXISTS idx_status_permissions_edit 
ON status_permissions(user_id, can_edit_all) WHERE can_edit_all = true;

-- Add indexes on projects table
CREATE INDEX IF NOT EXISTS idx_projects_status_id 
ON projects(status_id);

CREATE INDEX IF NOT EXISTS idx_projects_created_by 
ON projects(created_by);

CREATE INDEX IF NOT EXISTS idx_projects_sales_person 
ON projects(sales_person_id);

-- Add indexes for client_permissions
CREATE INDEX IF NOT EXISTS idx_client_permissions_user_client 
ON client_permissions(user_id, client_id);

CREATE INDEX IF NOT EXISTS idx_client_permissions_user_view 
ON client_permissions(user_id, can_view) WHERE can_view = true;

CREATE INDEX IF NOT EXISTS idx_client_permissions_user_edit 
ON client_permissions(user_id, can_edit) WHERE can_edit = true;

-- Add index on staff role for admin checks
CREATE INDEX IF NOT EXISTS idx_staff_role 
ON staff(role);

-- Add index on statuses parent relationship
CREATE INDEX IF NOT EXISTS idx_statuses_parent 
ON statuses(parent_status_id);
