/*
  # Add Categories to Share Resources

  1. New Tables
    - `share_resource_categories`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `created_at` (timestamptz)
  
  2. Changes
    - Add `category_id` column to `share_resources` table
    - Add foreign key constraint
  
  3. Data
    - Insert predefined categories:
      - BUD Resource
      - Information (前期資訊搜集)
      - Project Resource (InProgress)
      - Marketing Related
      - Email to check manually
      - Share login
      - EMF
  
  4. Security
    - Enable RLS on `share_resource_categories` table
    - Add policies for authenticated users to view categories
    - Add policies for authenticated users to create new categories
*/

-- Create share resource categories table
CREATE TABLE IF NOT EXISTS share_resource_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add category_id to share_resources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'share_resources' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE share_resources ADD COLUMN category_id uuid REFERENCES share_resource_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Insert predefined categories
INSERT INTO share_resource_categories (name) VALUES
  ('BUD Resource'),
  ('Information (前期資訊搜集)'),
  ('Project Resource (InProgress)'),
  ('Marketing Related'),
  ('Email to check manually'),
  ('Share login'),
  ('EMF')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE share_resource_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view categories
CREATE POLICY "Authenticated users can view categories"
  ON share_resource_categories FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to create categories
CREATE POLICY "Authenticated users can create categories"
  ON share_resource_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_share_resources_category_id ON share_resources(category_id);

-- Enable realtime for categories
ALTER PUBLICATION supabase_realtime ADD TABLE share_resource_categories;
