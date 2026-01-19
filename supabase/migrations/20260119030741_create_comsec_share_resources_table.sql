/*
  # Create ComSec Share Resources Table

  1. New Tables
    - `comsec_share_resources`
      - `id` (uuid, primary key)
      - `title` (text, required) - The title of the shared resource
      - `content` (text) - The text content or description
      - `resource_type` (text, required) - Type: 'text', 'image', 'link', 'file'
      - `image_url` (text) - URL for image resources
      - `external_url` (text) - URL for link resources
      - `file_path` (text) - Path to uploaded file in storage
      - `file_name` (text) - Original filename
      - `file_size` (bigint) - File size in bytes
      - `comsec_client_id` (uuid) - Optional link to specific ComSec client
      - `created_by` (uuid, foreign key to staff) - User who created the resource
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `comsec_share_resources` table
    - Add policies for authenticated users to:
      - View all resources
      - Create resources
      - Update their own resources
      - Delete their own resources

  3. Storage
    - Create storage bucket for ComSec shared resources
    - Set up proper access policies

  4. Realtime
    - Enable realtime for live updates
*/

-- Create the comsec_share_resources table
CREATE TABLE IF NOT EXISTS comsec_share_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  resource_type text NOT NULL CHECK (resource_type IN ('text', 'image', 'link', 'file')),
  image_url text,
  external_url text,
  file_path text,
  file_name text,
  file_size bigint,
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE,
  created_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_comsec_share_resources_client ON comsec_share_resources(comsec_client_id);
CREATE INDEX IF NOT EXISTS idx_comsec_share_resources_created_by ON comsec_share_resources(created_by);
CREATE INDEX IF NOT EXISTS idx_comsec_share_resources_type ON comsec_share_resources(resource_type);

-- Enable RLS
ALTER TABLE comsec_share_resources ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view all resources
CREATE POLICY "Authenticated users can view all comsec resources"
  ON comsec_share_resources
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create resources
CREATE POLICY "Authenticated users can create comsec resources"
  ON comsec_share_resources
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own resources
CREATE POLICY "Users can update their own comsec resources"
  ON comsec_share_resources
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Allow users to delete their own resources
CREATE POLICY "Users can delete their own comsec resources"
  ON comsec_share_resources
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create storage bucket for comsec shared resources
INSERT INTO storage.buckets (id, name, public)
VALUES ('comsec-share-resources', 'comsec-share-resources', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for comsec-share-resources bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload comsec resource files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comsec-share-resources');

-- Allow authenticated users to view all files
CREATE POLICY "Authenticated users can view comsec resource files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'comsec-share-resources');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own comsec resource files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'comsec-share-resources' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own files
CREATE POLICY "Users can update their own comsec resource files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'comsec-share-resources' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE comsec_share_resources;

-- Set replica identity for realtime updates
ALTER TABLE comsec_share_resources REPLICA IDENTITY FULL;
