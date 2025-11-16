/*
  # Create Invoice Field Mapping Settings

  1. New Tables
    - `invoice_template_tags`
      - `id` (uuid, primary key)
      - `tag_name` (text) - The placeholder tag like "<Company Name>"
      - `description` (text) - Human readable description
      - `is_active` (boolean) - Whether tag is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `invoice_field_mappings`
      - `id` (uuid, primary key)
      - `tag_id` (uuid) - References invoice_template_tags
      - `source_type` (text) - Either 'project' or 'client'
      - `source_field` (text) - The field name from project/client table
      - `default_value` (text) - Optional default if field is empty
      - `transform_function` (text) - Optional: 'uppercase', 'lowercase', 'date_format'
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Only authenticated users can view mappings
    - Only admins can modify mappings

  3. Seed Data
    - Create initial tag for "<Company Name>"
    - Create mapping to client company_name field
*/

-- Create invoice_template_tags table
CREATE TABLE IF NOT EXISTS invoice_template_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoice_field_mappings table
CREATE TABLE IF NOT EXISTS invoice_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid REFERENCES invoice_template_tags(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('project', 'client')),
  source_field text NOT NULL,
  default_value text,
  transform_function text CHECK (transform_function IN ('uppercase', 'lowercase', 'date_format', 'currency')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tag_id, source_type, source_field)
);

-- Enable RLS
ALTER TABLE invoice_template_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_field_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_template_tags
CREATE POLICY "Authenticated users can view tags"
  ON invoice_template_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert tags"
  ON invoice_template_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update tags"
  ON invoice_template_tags FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tags"
  ON invoice_template_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for invoice_field_mappings
CREATE POLICY "Authenticated users can view mappings"
  ON invoice_field_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert mappings"
  ON invoice_field_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update mappings"
  ON invoice_field_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete mappings"
  ON invoice_field_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_template_tags_active ON invoice_template_tags(is_active);
CREATE INDEX IF NOT EXISTS idx_invoice_field_mappings_tag_id ON invoice_field_mappings(tag_id);
CREATE INDEX IF NOT EXISTS idx_invoice_field_mappings_active ON invoice_field_mappings(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_invoice_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_invoice_template_tags_updated_at
  BEFORE UPDATE ON invoice_template_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_mappings_updated_at();

CREATE TRIGGER update_invoice_field_mappings_updated_at
  BEFORE UPDATE ON invoice_field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_mappings_updated_at();

-- Seed initial data
INSERT INTO invoice_template_tags (tag_name, description, is_active)
VALUES ('<Company Name>', 'Company name placeholder', true)
ON CONFLICT (tag_name) DO NOTHING;

-- Get the tag_id for Company Name
DO $$
DECLARE
  company_tag_id uuid;
BEGIN
  SELECT id INTO company_tag_id FROM invoice_template_tags WHERE tag_name = '<Company Name>';
  
  IF company_tag_id IS NOT NULL THEN
    INSERT INTO invoice_field_mappings (tag_id, source_type, source_field, is_active)
    VALUES (company_tag_id, 'client', 'company_name', true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;