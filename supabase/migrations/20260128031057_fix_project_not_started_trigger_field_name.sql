/*
  # Fix Project Not Started Trigger Field Name

  1. Changes
    - Update trigger function to use correct field name: `kickoff_date_with_first_payment` instead of `kickoff_date`
    - This fixes the error: "record 'new' has no field 'kickoff_date'"
  
  2. Notes
    - The trigger was referencing the wrong field name
    - The correct field name in the database is `kickoff_date_with_first_payment`
*/

-- Update the trigger function to use the correct field name
CREATE OR REPLACE FUNCTION auto_uncheck_project_not_started()
RETURNS TRIGGER AS $$
BEGIN
  -- If kickoff_date_with_first_payment is being set (from null to a value), uncheck project_not_started
  IF NEW.kickoff_date_with_first_payment IS NOT NULL AND (OLD.kickoff_date_with_first_payment IS NULL OR OLD.kickoff_date_with_first_payment IS DISTINCT FROM NEW.kickoff_date_with_first_payment) THEN
    NEW.project_not_started = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
