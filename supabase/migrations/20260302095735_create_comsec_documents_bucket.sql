/*
  # Create ComSec Documents Storage Bucket

  1. Storage Setup
    - Create `comsec-documents` bucket for storing ComSec-related files
    - Set bucket as public for easy access
    
  2. Security
    - Enable RLS on storage.objects
    - Allow authenticated users to upload files
    - Allow public to read files
    - Allow authenticated users to update/delete files
*/

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comsec-documents',
  'comsec-documents',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'image/gif', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload comsec files" ON storage.objects;
  DROP POLICY IF EXISTS "Public read access comsec" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update comsec files" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete comsec files" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload comsec files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comsec-documents');

-- Allow public read access
CREATE POLICY "Public read access comsec"
ON storage.objects
FOR SELECT
USING (bucket_id = 'comsec-documents');

-- Allow authenticated users to update files
CREATE POLICY "Authenticated users can update comsec files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'comsec-documents')
WITH CHECK (bucket_id = 'comsec-documents');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete comsec files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'comsec-documents');
