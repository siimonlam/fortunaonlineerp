/*
  # Create funding_document_checklist table

  ## Summary
  Creates a master checklist table for funding project document requirements.

  ## New Tables
  - `funding_document_checklist`
    - `id` (uuid, primary key)
    - `category` (text) — grouping category, e.g. "Hiring", "Office Setup", "Marketing"
    - `document_name` (text) — display name of the document, e.g. "僱傭合約 Employment contract"
    - `description` (text) — additional guidance or notes
    - `is_required` (boolean) — whether the document is mandatory
    - `order_index` (integer) — display order within a category
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can read all checklist items
  - Only admins (via user_roles) can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS funding_document_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT '',
  document_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_required boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE funding_document_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read funding document checklist"
  ON funding_document_checklist
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert funding document checklist"
  ON funding_document_checklist
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update funding document checklist"
  ON funding_document_checklist
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete funding document checklist"
  ON funding_document_checklist
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_funding_document_checklist_category ON funding_document_checklist(category);
CREATE INDEX IF NOT EXISTS idx_funding_document_checklist_order ON funding_document_checklist(category, order_index);
