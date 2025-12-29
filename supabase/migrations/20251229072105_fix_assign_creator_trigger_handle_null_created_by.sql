/*
  # Fix Assign Creator Trigger to Handle NULL created_by

  1. Changes
    - Update assign_creator_to_project() function to only insert if created_by is NOT NULL
    - This allows CSV imports without a creator
  
  2. Notes
    - Projects with a creator will still have them added to project_staff
    - Projects without a creator (from CSV imports) will skip this step
*/

-- Update the function to handle NULL created_by
CREATE OR REPLACE FUNCTION assign_creator_to_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Only insert if created_by is not NULL
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO project_staff (project_id, staff_id, user_id, can_view, can_edit)
    VALUES (NEW.id, NEW.created_by, NEW.created_by, true, true)
    ON CONFLICT (project_id, staff_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
