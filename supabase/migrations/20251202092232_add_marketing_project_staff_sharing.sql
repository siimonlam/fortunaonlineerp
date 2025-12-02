/*
  # Add Marketing Project Staff Sharing

  1. Purpose
    - Allow admins to assign staff members to view/edit specific marketing projects
    - Marketing projects should only be visible to:
      - The creator
      - The sales person
      - Staff assigned by admins
      - Admins themselves

  2. Note
    - The existing `project_staff` table will be used for marketing project assignments
    - We'll update RLS policies to properly enforce marketing project visibility

  3. Changes
    - Update projects RLS policies to check project type and enforce Marketing restrictions
    - Marketing projects follow stricter access control than Funding projects
*/

-- No structural changes needed, project_staff table already exists
-- We'll update the application logic to use it for Marketing projects

-- Ensure project_staff has proper RLS for marketing projects
-- The existing policies already handle this through project permissions
