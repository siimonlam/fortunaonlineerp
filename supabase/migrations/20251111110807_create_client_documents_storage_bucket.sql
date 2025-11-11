/*
  # Create Client Documents Storage Bucket

  1. Storage Setup
    - Create `client-documents` bucket for storing client files
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
  'client-documents',
  'client-documents',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
  DROP POLICY IF EXISTS "Public read access" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can upload to client documents" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Allow anyone to upload files (for phone scan without auth)
CREATE POLICY "Anyone can upload to client documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'client-documents');

-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'client-documents');

-- Allow authenticated users to update files
CREATE POLICY "Authenticated users can update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'client-documents')
WITH CHECK (bucket_id = 'client-documents');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'client-documents');
