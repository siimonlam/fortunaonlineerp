/*
  # Fix Assign Creator Trigger to Include user_id

  1. Changes
    - Update assign_creator_to_project() function to include user_id when inserting into project_staff
    - This fixes the "null value in column user_id" error when creating projects

  2. Notes
    - user_id and staff_id should have the same value (both referencing the creator)
    - can_view and can_edit default to true for the creator
*/

-- Update the function to include user_id
CREATE OR REPLACE FUNCTION assign_creator_to_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_staff (project_id, staff_id, user_id, can_view, can_edit)
  VALUES (NEW.id, NEW.created_by, NEW.created_by, true, true)
  ON CONFLICT (project_id, staff_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
