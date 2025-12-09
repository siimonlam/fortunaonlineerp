/*
  # Change next_hkpc_due_date column to timestamp with time zone

  1. Changes
    - Drop the trigger that depends on the column
    - Alter the `next_hkpc_due_date` column in the `projects` table from `date` to `timestamptz`
    - Recreate the trigger

  2. Notes
    - This allows storing both date AND time for HKPC due dates
    - Existing date-only values will be automatically converted to timestamps at midnight UTC
    - All existing dates will be preserved, with time set to 00:00:00 UTC
*/

-- Drop the trigger temporarily
DROP TRIGGER IF EXISTS on_next_hkpc_due_date_change ON projects;

-- Alter the column type
ALTER TABLE projects 
  ALTER COLUMN next_hkpc_due_date TYPE timestamptz 
  USING next_hkpc_due_date::timestamptz;

-- Recreate the trigger
CREATE TRIGGER on_next_hkpc_due_date_change
  AFTER UPDATE OF next_hkpc_due_date ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_on_hkpc_date_change();
