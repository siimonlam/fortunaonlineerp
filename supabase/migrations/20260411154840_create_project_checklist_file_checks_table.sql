/*
  # Create project_checklist_file_checks table + add document_type to project_checklist_files

  ## Overview
  When a file is synced into project_checklist_files, we know which folder it
  came from. That folder maps to a checklist item (project_checklist_items) which
  has a document_name (e.g. "Quotation 報價", "供應商發票", "反圍標"). Using that
  document_name we can look up all required verification points from
  funding_document_checklist (e.g. 供應商簽名, 採購公司蓋印, 日期…).

  This migration:
  1. Adds `document_type` (text) to project_checklist_files — stores the matched
     document_name from funding_document_checklist so we always know what kind of
     document this file is.
  2. Creates `project_checklist_file_checks` — one row per (file, check_item) so
     each file tracks its own completion status for every required check.

  ## New Table: project_checklist_file_checks
  - `id`                  — primary key
  - `file_id`             — FK → project_checklist_files.id
  - `checklist_item_id`   — FK → project_checklist_items.id (the parent folder/item)
  - `project_id`          — denormalised for easier querying
  - `document_type`       — the document_name, e.g. "Quotation 報價"
  - `category`            — the category, e.g. "核數"
  - `description`         — the specific check, e.g. "供應商簽名"
  - `order_index`         — ordering from funding_document_checklist
  - `is_required`         — from funding_document_checklist
  - `is_checked`          — reviewer has confirmed this check passes (default false)
  - `checked_by`          — uuid of user who checked
  - `checked_at`          — when it was checked
  - `is_checked_by_ai`    — AI auto-checked (default false)
  - `ai_result`           — raw AI result text
  - `notes`               — reviewer notes

  ## Security
  - RLS enabled; authenticated users can read/update
*/

-- 1. Add document_type to project_checklist_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_files' AND column_name = 'document_type'
  ) THEN
    ALTER TABLE project_checklist_files ADD COLUMN document_type text;
  END IF;
END $$;

-- 2. Create the file-level checks table
CREATE TABLE IF NOT EXISTS project_checklist_file_checks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id             uuid NOT NULL REFERENCES project_checklist_files(id) ON DELETE CASCADE,
  checklist_item_id   uuid NOT NULL REFERENCES project_checklist_items(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_type       text NOT NULL,
  category            text,
  description         text NOT NULL,
  order_index         integer DEFAULT 0,
  is_required         boolean NOT NULL DEFAULT true,
  is_checked          boolean NOT NULL DEFAULT false,
  checked_by          uuid REFERENCES auth.users(id),
  checked_at          timestamptz,
  is_checked_by_ai    boolean NOT NULL DEFAULT false,
  ai_result           text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_pcfc_file_id           ON project_checklist_file_checks(file_id);
CREATE INDEX IF NOT EXISTS idx_pcfc_checklist_item_id ON project_checklist_file_checks(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_pcfc_project_id        ON project_checklist_file_checks(project_id);

-- RLS
ALTER TABLE project_checklist_file_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view file checks"
  ON project_checklist_file_checks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert file checks"
  ON project_checklist_file_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update file checks"
  ON project_checklist_file_checks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete file checks"
  ON project_checklist_file_checks
  FOR DELETE
  TO authenticated
  USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE project_checklist_file_checks;
