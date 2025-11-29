/*
  # Simplify RLS - Allow All Authenticated Users
  
  1. Changes
    - Remove all complex permission checks
    - Allow all authenticated users to view and edit all projects
    - Keep only basic authentication check
    
  2. Performance Impact
    - Eliminates ALL permission checking overhead
    - Fastest possible RLS policy
    - No function calls, no subqueries, no joins
    
  3. Security
    - Only authenticated users can access data
    - All staff members have full access
*/

-- Drop all permission-related functions with CASCADE
DROP FUNCTION IF EXISTS can_user_view_project(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS can_user_edit_project(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_status_permission(uuid, uuid, text) CASCADE;

-- ============================================
-- PROJECTS TABLE - Simplified RLS
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Staff can view projects" ON projects;
DROP POLICY IF EXISTS "Staff can update projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Project creators can delete projects" ON projects;

-- Simple policies: all authenticated users can do everything
CREATE POLICY "All authenticated users can view projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "All authenticated users can delete projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- CLIENTS TABLE - Simplified RLS
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON clients;

CREATE POLICY "All authenticated users can view clients"
  ON clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can insert clients"
  ON clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update clients"
  ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete clients"
  ON clients FOR DELETE TO authenticated USING (true);

-- ============================================
-- TASKS TABLE - Simplified RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view tasks for projects they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks for projects they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks for projects they have access to" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks for projects they have access to" ON tasks;

CREATE POLICY "All authenticated users can view tasks"
  ON tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can insert tasks"
  ON tasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update tasks"
  ON tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete tasks"
  ON tasks FOR DELETE TO authenticated USING (true);

-- ============================================
-- PROJECT_LABELS TABLE - Simplified RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view project labels for accessible projects" ON project_labels;
DROP POLICY IF EXISTS "Users can insert project labels for editable projects" ON project_labels;
DROP POLICY IF EXISTS "Users can delete project labels for editable projects" ON project_labels;

CREATE POLICY "All authenticated users can view project_labels"
  ON project_labels FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can insert project_labels"
  ON project_labels FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update project_labels"
  ON project_labels FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete project_labels"
  ON project_labels FOR DELETE TO authenticated USING (true);

-- ============================================
-- PROJECT_HISTORY TABLE - Simplified RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view project history for accessible projects" ON project_history;

CREATE POLICY "All authenticated users can view project_history"
  ON project_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can insert project_history"
  ON project_history FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- PROJECT_COMMENTS TABLE - Simplified RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view comments for accessible projects" ON project_comments;
DROP POLICY IF EXISTS "Users can insert comments for accessible projects" ON project_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON project_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON project_comments;

CREATE POLICY "All authenticated users can view project_comments"
  ON project_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can insert project_comments"
  ON project_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update project_comments"
  ON project_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete project_comments"
  ON project_comments FOR DELETE TO authenticated USING (true);

-- ============================================
-- COMSEC TABLES - Simplified RLS
-- ============================================

DROP POLICY IF EXISTS "Authenticated users with Com Sec access can view comsec_clients" ON comsec_clients;
DROP POLICY IF EXISTS "Authenticated users with Com Sec access can insert comsec_clients" ON comsec_clients;
DROP POLICY IF EXISTS "Authenticated users with Com Sec access can update comsec_clients" ON comsec_clients;
DROP POLICY IF EXISTS "Authenticated users with Com Sec access can delete comsec_clients" ON comsec_clients;

CREATE POLICY "All authenticated users can view comsec_clients"
  ON comsec_clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can insert comsec_clients"
  ON comsec_clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update comsec_clients"
  ON comsec_clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete comsec_clients"
  ON comsec_clients FOR DELETE TO authenticated USING (true);

-- ============================================
-- CHANNEL PARTNERS - Simplified RLS
-- ============================================

DROP POLICY IF EXISTS "Users with partner permissions can view channel_partners" ON channel_partners;
DROP POLICY IF EXISTS "Users with partner permissions can insert channel_partners" ON channel_partners;
DROP POLICY IF EXISTS "Users with partner permissions can update channel_partners" ON channel_partners;
DROP POLICY IF EXISTS "Users with partner permissions can delete channel_partners" ON channel_partners;

CREATE POLICY "All authenticated users can view channel_partners"
  ON channel_partners FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can insert channel_partners"
  ON channel_partners FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can update channel_partners"
  ON channel_partners FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete channel_partners"
  ON channel_partners FOR DELETE TO authenticated USING (true);

-- Update table statistics for query optimizer
ANALYZE projects;
ANALYZE clients;
ANALYZE tasks;
ANALYZE project_labels;
ANALYZE comsec_clients;
ANALYZE channel_partners;
