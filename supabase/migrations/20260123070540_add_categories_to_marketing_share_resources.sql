/*
  # Add Categories to Marketing Share Resources

  1. New Tables
    - `marketing_resource_categories`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `created_at` (timestamptz)
  
  2. Changes
    - Add `category_id` column to `marketing_share_resources` table
    - Add foreign key constraint
  
  3. Data
    - Insert predefined categories:
      - share login
      - Import Links
  
  4. Security
    - Enable RLS on `marketing_resource_categories` table
    - Add policies for authenticated users to view and create categories
*/

-- Create marketing resource categories table
CREATE TABLE IF NOT EXISTS marketing_resource_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add category_id to marketing_share_resources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_share_resources' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE marketing_share_resources ADD COLUMN category_id uuid REFERENCES marketing_resource_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Insert predefined categories
INSERT INTO marketing_resource_categories (name) VALUES
  ('share login'),
  ('Import Links')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE marketing_resource_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view categories
CREATE POLICY "Authenticated users can view marketing resource categories"
  ON marketing_resource_categories FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to create categories
CREATE POLICY "Authenticated users can create marketing resource categories"
  ON marketing_resource_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_marketing_share_resources_category_id ON marketing_share_resources(category_id);

-- Enable realtime for categories
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_resource_categories;
