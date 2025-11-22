/*
  # Create Receipt Field Mapping Tables

  1. New Tables
    - `receipt_template_tags`
      - Template tag names and descriptions for receipt PDF fields
    - `receipt_field_mappings`
      - Maps template tags to receipt data fields

  2. Security
    - Enable RLS on both tables
    - Allow authenticated users to manage mappings
*/

-- Create receipt_template_tags table
CREATE TABLE IF NOT EXISTS receipt_template_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create receipt_field_mappings table
CREATE TABLE IF NOT EXISTS receipt_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid REFERENCES receipt_template_tags(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('receipt')),
  source_field text NOT NULL,
  default_value text,
  transform_function text CHECK (transform_function IN ('uppercase', 'lowercase', 'date_format', 'currency')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE receipt_template_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_field_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for receipt_template_tags
CREATE POLICY "Authenticated users can view receipt tags"
  ON receipt_template_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage receipt tags"
  ON receipt_template_tags FOR ALL
  TO authenticated
  USING (true);

-- Create policies for receipt_field_mappings
CREATE POLICY "Authenticated users can view receipt mappings"
  ON receipt_field_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage receipt mappings"
  ON receipt_field_mappings FOR ALL
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_receipt_field_mappings_tag_id ON receipt_field_mappings(tag_id);
