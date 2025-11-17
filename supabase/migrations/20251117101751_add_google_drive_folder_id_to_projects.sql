/*
  # Add Google Drive Folder ID to Projects

  1. Changes
    - Add `google_drive_folder_id` column to `projects` table
      - Stores the Google Drive folder ID for the project
      - Optional field - can be manually set or auto-populated
      - Useful for linking existing folders without creating new ones

  2. Notes
    - This allows users to manually specify existing Google Drive folders
    - When set, the "Create Folder" button should be disabled
*/

-- Add google_drive_folder_id column to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'google_drive_folder_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN google_drive_folder_id text;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_google_drive_folder_id 
  ON projects(google_drive_folder_id) 
  WHERE google_drive_folder_id IS NOT NULL;