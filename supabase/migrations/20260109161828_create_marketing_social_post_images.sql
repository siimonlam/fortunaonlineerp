/*
  # Create Marketing Social Post Images Table

  1. New Tables
    - `marketing_social_post_images`
      - `id` (uuid, primary key)
      - `post_id` (uuid, foreign key to marketing_social_posts)
      - `file_name` (text) - Original file name
      - `google_drive_file_id` (text) - Google Drive file ID
      - `google_drive_url` (text) - Direct link to image in Google Drive
      - `thumbnail_url` (text) - Thumbnail URL if available
      - `file_size` (bigint) - File size in bytes
      - `mime_type` (text) - MIME type of the image
      - `uploaded_by` (uuid, foreign key to staff)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Users can view images for posts they have access to
    - Users can upload images to posts they have access to
    - Users can delete images they uploaded

  3. Indexes
    - Index on post_id for fast lookups
    - Index on uploaded_by
*/

-- Create marketing_social_post_images table
CREATE TABLE IF NOT EXISTS marketing_social_post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES marketing_social_posts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  google_drive_file_id text NOT NULL,
  google_drive_url text NOT NULL,
  thumbnail_url text,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketing_social_post_images_post ON marketing_social_post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_marketing_social_post_images_uploaded_by ON marketing_social_post_images(uploaded_by);

-- Enable RLS
ALTER TABLE marketing_social_post_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view images for posts they have access to"
  ON marketing_social_post_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_social_posts msp
      JOIN marketing_project_staff mps ON mps.project_id = msp.marketing_project_id
      WHERE msp.id = marketing_social_post_images.post_id
      AND mps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload images to posts they have access to"
  ON marketing_social_post_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_social_posts msp
      JOIN marketing_project_staff mps ON mps.project_id = msp.marketing_project_id
      WHERE msp.id = marketing_social_post_images.post_id
      AND mps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their uploaded images"
  ON marketing_social_post_images FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_social_post_images;
