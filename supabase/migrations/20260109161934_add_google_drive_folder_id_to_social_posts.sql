/*
  # Add Google Drive Folder ID to Marketing Social Posts

  1. Schema Changes
    - Add `google_drive_folder_id` column to `marketing_social_posts` table
    - This will store the Google Drive folder ID where post images are uploaded

  2. Purpose
    - Each social post will have its own folder in Google Drive
    - Images uploaded for the post will be stored in this folder
    - The folder is created when using the create-social-post-folders edge function
*/

-- Add google_drive_folder_id column
ALTER TABLE marketing_social_posts
ADD COLUMN IF NOT EXISTS google_drive_folder_id text;
