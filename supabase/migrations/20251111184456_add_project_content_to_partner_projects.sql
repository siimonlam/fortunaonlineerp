/*
  # Add project_content column to partner_projects table

  1. Changes
    - Add `project_content` column to `partner_projects` table
      - Type: text (allows long descriptions)
      - Nullable: true (optional field)
      - Default: null

  2. Notes
    - This field will store detailed information about the partner project
    - No data migration needed as it's a new optional field
*/

-- Add project_content column to partner_projects table
ALTER TABLE partner_projects
ADD COLUMN IF NOT EXISTS project_content text DEFAULT null;
