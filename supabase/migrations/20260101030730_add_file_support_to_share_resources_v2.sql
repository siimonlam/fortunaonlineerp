/*
  # Add File Support to Share Resources

  1. Changes
    - Add 'file' to the resource_type enum
    - Add file_path column for storing file references
    - Add file_name column for original file names
    - Add file_size column for tracking file sizes
    
  2. Storage Bucket
    - Create a storage bucket for shared resource files
    - Set up proper access policies
*/

-- Add file support columns to share_resources table
DO $$ 
BEGIN
  -- Add file_path column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'share_resources' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE share_resources ADD COLUMN file_path text;
  END IF;

  -- Add file_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'share_resources' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE share_resources ADD COLUMN file_name text;
  END IF;

  -- Add file_size column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'share_resources' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE share_resources ADD COLUMN file_size bigint;
  END IF;
END $$;

-- Drop the old constraint and create a new one with 'file' included
ALTER TABLE share_resources DROP CONSTRAINT IF EXISTS share_resources_resource_type_check;
ALTER TABLE share_resources ADD CONSTRAINT share_resources_resource_type_check 
  CHECK (resource_type IN ('text', 'image', 'link', 'file'));

-- Create storage bucket for shared resources
INSERT INTO storage.buckets (id, name, public)
VALUES ('share-resources', 'share-resources', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for share-resources bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'share-resources');

-- Allow authenticated users to view all files
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'share-resources');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'share-resources' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'share-resources' AND auth.uid()::text = (storage.foldername(name))[1]);
