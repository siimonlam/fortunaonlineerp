/*
  # Add Performance Indexes for RLS Optimization
  
  1. Changes
    - Add indexes on foreign keys used in RLS policies
    - Add indexes on columns used in JOIN operations
    - Add composite indexes for common query patterns
    
  2. Performance Impact
    - Dramatically speeds up RLS policy checks
    - Reduces query time for project access verification
    - Improves overall application load time
*/

-- Index for projects.created_by (used in RLS checks)
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Index for projects.sales_person_id (used in RLS checks)
CREATE INDEX IF NOT EXISTS idx_projects_sales_person_id ON projects(sales_person_id);

-- Index for projects.status_id (used frequently in queries and RLS)
CREATE INDEX IF NOT EXISTS idx_projects_status_id ON projects(status_id);

-- Index for projects.project_type_id (used in filtering)
CREATE INDEX IF NOT EXISTS idx_projects_project_type_id ON projects(project_type_id);

-- Index for project_permissions lookups
CREATE INDEX IF NOT EXISTS idx_project_permissions_project_user ON project_permissions(project_id, user_id);

-- Index for status_permissions lookups (critical for RLS performance)
CREATE INDEX IF NOT EXISTS idx_status_permissions_user_status ON status_permissions(user_id, status_id);
CREATE INDEX IF NOT EXISTS idx_status_permissions_status_can_view ON status_permissions(status_id, can_view_all);

-- Index for statuses.parent_status_id (used in subquery checks)
CREATE INDEX IF NOT EXISTS idx_statuses_parent_status_id ON statuses(parent_status_id);

-- Index for staff.role (used in admin checks)
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role) WHERE role IS NOT NULL;

-- Index for project_staff (legacy support)
CREATE INDEX IF NOT EXISTS idx_project_staff_project_staff ON project_staff(project_id, staff_id);

-- Index for tasks queries
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- Index for clients queries
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_sales_person_id ON clients(sales_person_id);

-- Composite index for common project queries
CREATE INDEX IF NOT EXISTS idx_projects_type_status ON projects(project_type_id, status_id);
