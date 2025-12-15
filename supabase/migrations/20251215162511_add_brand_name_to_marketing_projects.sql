/*
  # Add brand_name to marketing_projects

  1. Changes
    - Add `brand_name` column to marketing_projects table for sidebar display
  
  2. Notes
    - Brand name will be used for displaying marketing projects in the sidebar
    - This field can be different from company_name (e.g., "G-NiiB" vs "G-NiiB Microbiota I-Center Limited")
*/

ALTER TABLE marketing_projects ADD COLUMN IF NOT EXISTS brand_name text;

COMMENT ON COLUMN marketing_projects.brand_name IS 'Brand name for display in UI (e.g., G-NiiB)';
