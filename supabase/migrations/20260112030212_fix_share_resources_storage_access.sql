/*
  # Fix Share Resources Storage Access

  1. Changes
    - Add service_role policy for share-resources bucket
    - Ensure service role can download files for email attachments

  2. Security
    - Service role needs full access to process email attachments
    - Regular users still need authentication
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Service role can access all files" ON storage.objects;

-- Add service role policy for SELECT (needed for downloading)
CREATE POLICY "Service role can access all files"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'share-resources');

-- Ensure the bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public)
VALUES ('share-resources', 'share-resources', false)
ON CONFLICT (id) DO UPDATE
SET public = false;
