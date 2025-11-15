/*
  # Add change_status to automation action types

  1. Changes
    - Update the action_type check constraint to include 'change_status'
    - This allows automation rules to change project statuses

  2. Notes
    - Drops and recreates the constraint with the new value
*/

-- Drop the old constraint
ALTER TABLE automation_rules
DROP CONSTRAINT IF EXISTS automation_rules_action_type_check;

-- Add the updated constraint with change_status included
ALTER TABLE automation_rules
ADD CONSTRAINT automation_rules_action_type_check
CHECK (action_type = ANY (ARRAY['add_task'::text, 'add_label'::text, 'remove_label'::text, 'change_status'::text]));