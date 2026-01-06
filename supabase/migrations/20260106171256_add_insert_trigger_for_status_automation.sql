/*
  # Add INSERT Trigger for Status Change Automation

  1. Changes
    - Add a trigger that fires on INSERT to handle projects created with specific statuses
    - This ensures automation runs even when status is set during project creation
  
  2. Purpose
    - Fix automation not running when projects are created with Hi-Po or other statuses
    - Complement the existing UPDATE trigger
*/

-- Create trigger for INSERT operations
CREATE OR REPLACE TRIGGER on_status_change_automation_insert
  AFTER INSERT ON projects
  FOR EACH ROW
  WHEN (NEW.status_id IS NOT NULL)
  EXECUTE FUNCTION trigger_automation_on_status_change();
