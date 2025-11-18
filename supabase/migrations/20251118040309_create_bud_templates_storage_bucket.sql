/*
  # Create BUD Templates Storage Bucket

  1. New Storage Bucket
    - `bud-templates` - Public bucket for storing BUD folder template files
    - Files in this bucket will be copied to new project folders in Google Drive

  2. Security
    - Public read access for authenticated users
    - Only admins can upload/update template files
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bud-templates',
  'bud-templates',
  true,
  52428800,
  NULL
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated users to read BUD templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'bud-templates');

CREATE POLICY "Allow admins to upload BUD templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bud-templates' AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Allow admins to update BUD templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'bud-templates' AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Allow admins to delete BUD templates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bud-templates' AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);