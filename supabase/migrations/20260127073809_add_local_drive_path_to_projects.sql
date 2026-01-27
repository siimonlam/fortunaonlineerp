/*
  # Add Local Drive Path to Projects

  1. Changes
    - Add `local_drive_path` column to `projects` table
      - Stores Windows/Mac local path for Google Drive synced folders
      - Example: "H:\Shared drives\BUD\Silllk-2nd"
    
  2. Purpose
    - Allows users to open the local Google Drive Desktop folder
    - Provides quick access to synced files in File Explorer/Finder
*/

-- Add local_drive_path column to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS local_drive_path text;

-- Add comment to explain the column
COMMENT ON COLUMN projects.local_drive_path IS 'Local file system path for Google Drive Desktop synced folder (e.g., H:\Shared drives\BUD\ProjectName)';
