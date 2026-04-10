/*
  # Create project_checklist_items table

  ## Summary
  Creates a per-project checklist tracking table that links projects to the master
  funding_document_checklist, allowing staff to track which checklist criteria have
  been verified/completed for each specific project.

  ## New Tables
  - `project_checklist_items`
    - `id` (uuid, primary key)
    - `project_id` (uuid, FK to projects)
    - `checklist_id` (uuid, FK to funding_document_checklist)
    - `category` (text) - denormalized for easy filtering
    - `document_name` (text) - denormalized for easy display
    - `description` (text) - the specific criterion being checked
    - `is_checked` (boolean) - whether this item has been verified
    - `notes` (text) - optional staff notes
    - `checked_by` (uuid, FK to auth.users) - who checked it
    - `checked_at` (timestamptz) - when it was checked
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled with policies for authenticated users
  - All authenticated users can view and update checklist items
*/

CREATE TABLE IF NOT EXISTS project_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  checklist_id uuid NOT NULL REFERENCES funding_document_checklist(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT '',
  document_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_checked boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, checklist_id)
);

ALTER TABLE project_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project checklist items"
  ON project_checklist_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert project checklist items"
  ON project_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project checklist items"
  ON project_checklist_items FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project checklist items"
  ON project_checklist_items FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_project_checklist_items_project_id ON project_checklist_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_checklist_items_checklist_id ON project_checklist_items(checklist_id);
