/*
  # Restrict Marketing Project Visibility

  1. Purpose
    - Marketing projects should only be visible to:
      - The project creator
      - The assigned sales person
      - Staff explicitly granted access via project_staff table
      - Admins

  2. Changes
    - Add helper function to check if user can view marketing projects
    - Ensure project_staff assignments work for marketing projects

  3. Security
    - More restrictive than Funding projects
    - Requires explicit permission grants by admins
*/

-- Helper function to check if user can view a specific marketing project
CREATE OR REPLACE FUNCTION can_view_marketing_project(project_id_param uuid, user_id_param uuid)
RETURNS boolean AS $$
DECLARE
  project_record RECORD;
  is_user_admin boolean;
  has_project_access boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_id_param AND role = 'admin'
  ) INTO is_user_admin;

  IF is_user_admin THEN
    RETURN true;
  END IF;

  -- Get project details
  SELECT created_by, sales_person_id, project_type_id
  INTO project_record
  FROM projects
  WHERE id = project_id_param;

  -- Check if user is creator or sales person
  IF project_record.created_by = user_id_param OR project_record.sales_person_id = user_id_param THEN
    RETURN true;
  END IF;

  -- Check if user has explicit access via project_staff
  SELECT EXISTS (
    SELECT 1 FROM project_staff
    WHERE project_id = project_id_param
    AND user_id = user_id_param
    AND can_view = true
  ) INTO has_project_access;

  RETURN has_project_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION can_view_marketing_project(uuid, uuid) TO authenticated;
