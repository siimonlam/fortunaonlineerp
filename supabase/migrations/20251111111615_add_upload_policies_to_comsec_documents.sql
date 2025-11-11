/*
  # Add Upload Policies to ComSec Documents Bucket

  1. Security
    - Allow anyone to upload files to comsec-documents (for phone scan without auth)
    - Maintain existing read/update/delete policies for authenticated users
*/

-- Drop existing phone scan policy if it exists
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can upload to comsec documents" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Allow anyone to upload files to comsec-documents (for phone scan without auth)
CREATE POLICY "Anyone can upload to comsec documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'comsec-documents');
