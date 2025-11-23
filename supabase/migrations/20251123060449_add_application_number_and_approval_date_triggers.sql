/*
  # Add Application Number and Approval Date Trigger Types

  1. Changes
    - Update the trigger_type check constraint to include 'application_number_set' and 'approval_date_set'
    - These trigger types allow automation rules to trigger when:
      - Application number field is set on a project
      - Approval date field is set on a project

  2. Notes
    - Drops and recreates the constraint with all supported trigger types including the new ones
*/

-- Drop the old constraint
ALTER TABLE automation_rules
DROP CONSTRAINT IF EXISTS automation_rules_trigger_type_check;

-- Add the updated constraint with all trigger types including the new ones
ALTER TABLE automation_rules
ADD CONSTRAINT automation_rules_trigger_type_check
CHECK (trigger_type = ANY (ARRAY[
  'hkpc_date_set'::text, 
  'task_completed'::text, 
  'status_changed'::text, 
  'periodic'::text, 
  'deposit_paid'::text, 
  'days_after_date'::text,
  'application_number_set'::text,
  'approval_date_set'::text
]));