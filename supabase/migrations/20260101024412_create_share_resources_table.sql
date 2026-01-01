/*
  # Create Share Resources Table

  1. New Tables
    - `share_resources`
      - `id` (uuid, primary key)
      - `title` (text, required) - The title of the shared resource
      - `content` (text) - The text content or description
      - `resource_type` (text, required) - Type: 'text', 'image', or 'link'
      - `image_url` (text) - URL for image resources
      - `external_url` (text) - URL for link resources
      - `created_by` (uuid, foreign key to staff) - User who created the resource
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `share_resources` table
    - Add policies for authenticated users to:
      - View all resources
      - Create resources
      - Update their own resources
      - Delete their own resources

  3. Realtime
    - Enable realtime for live updates
*/

-- Create the share_resources table
CREATE TABLE IF NOT EXISTS share_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  resource_type text NOT NULL CHECK (resource_type IN ('text', 'image', 'link')),
  image_url text,
  external_url text,
  created_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE share_resources ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view all resources
CREATE POLICY "Authenticated users can view all resources"
  ON share_resources
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create resources
CREATE POLICY "Authenticated users can create resources"
  ON share_resources
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own resources
CREATE POLICY "Users can update their own resources"
  ON share_resources
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Allow users to delete their own resources
CREATE POLICY "Users can delete their own resources"
  ON share_resources
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE share_resources;
