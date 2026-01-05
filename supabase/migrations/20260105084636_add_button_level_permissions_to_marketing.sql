/*
  # Add Button-Level Permissions for Marketing Projects

  1. Changes
    - Add button permissions to marketing_project_staff table
    - Create junction table for fine-grained button access control
    - Update RLS policies to respect button permissions

  2. New Fields
    - Add visible_sections jsonb field to marketing_project_staff
      This stores an array of section IDs that the user can access

  3. Security
    - Only users with access to specific sections can view them
    - Admins and project creators have access to all sections
*/

-- Add visible_sections field to marketing_project_staff
ALTER TABLE marketing_project_staff
ADD COLUMN IF NOT EXISTS visible_sections jsonb DEFAULT '[]'::jsonb;

-- Add comment explaining the field
COMMENT ON COLUMN marketing_project_staff.visible_sections IS 
'Array of section IDs the user can access. Empty array = access to all sections. 
Valid section IDs: summary, instagram-post, facebook-post, meta-ad, amazon-sales, amazon-ad, website, google-ad, influencer-collab, influencer-management, social-media, tasks, meetings, files';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_marketing_project_staff_sections 
  ON marketing_project_staff USING gin(visible_sections);
