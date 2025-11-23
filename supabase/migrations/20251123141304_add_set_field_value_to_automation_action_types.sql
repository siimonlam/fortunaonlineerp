/*
  # Add set_field_value to automation action types

  1. Changes
    - Drop existing action_type check constraint
    - Add new constraint including 'set_field_value' action type
  
  2. Details
    - Allows automation rules to set field values on projects
    - Supports date field updates with current_date or specific_date values
*/

ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_action_type_check;

ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_action_type_check 
  CHECK (action_type = ANY (ARRAY['add_task'::text, 'add_label'::text, 'remove_label'::text, 'change_status'::text, 'set_field_value'::text]));