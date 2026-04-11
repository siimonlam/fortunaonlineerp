/*
  # Create project_checklist_files table

  ## Summary
  Adds a new table to support a one-to-many relationship between a checklist item
  and the actual files uploaded against it. A single checklist requirement (e.g.
  "Quotation 報價") can have multiple physical documents attached.

  ## New Tables

  ### `project_checklist_files`
  - `id` (uuid, PK) — unique identifier for each file record
  - `checklist_item_id` (uuid, FK → project_checklist_items.id CASCADE) — links
    this file to a specific checklist item; deleting the item cascades to its files
  - `file_url` (text, not null) — Google Drive or Supabase Storage URL
  - `file_name` (text, not null) — human-readable filename for display
  - `extracted_data` (jsonb, default '{}') — AI-extracted structured data for this
    specific file (e.g. dates, amounts, vendor names)
  - `is_verified_by_ai` (boolean, default false) — whether AI has reviewed this file
  - `uploaded_by` (uuid, nullable, FK → auth.users) — the user who uploaded the file
  - `created_at` (timestamptz, default now())

  ## Security
  - RLS enabled; table is locked down by default
  - Four separate policies (SELECT, INSERT, UPDATE, DELETE) for authenticated users
  - All policies require `auth.uid()` to be non-null (i.e. authenticated session)

  ## Indexes
  - `idx_project_checklist_files_checklist_item_id` on `checklist_item_id` for fast
    lookups of all files belonging to a given checklist item
  - `idx_project_checklist_files_uploaded_by` on `uploaded_by` for user-scoped queries
*/

CREATE TABLE IF NOT EXISTS project_checklist_files (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id   uuid NOT NULL
    REFERENCES project_checklist_items(id) ON DELETE CASCADE,
  file_url            text NOT NULL,
  file_name           text NOT NULL,
  extracted_data      jsonb NOT NULL DEFAULT '{}',
  is_verified_by_ai   boolean NOT NULL DEFAULT false,
  uploaded_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_checklist_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist files"
  ON project_checklist_files
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert checklist files"
  ON project_checklist_files
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update checklist files"
  ON project_checklist_files
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete checklist files"
  ON project_checklist_files
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_project_checklist_files_checklist_item_id
  ON project_checklist_files(checklist_item_id);

CREATE INDEX IF NOT EXISTS idx_project_checklist_files_uploaded_by
  ON project_checklist_files(uploaded_by);
