/*
  # Add days_before_date Trigger Type

  1. Changes
    - Update the trigger_type check constraint to include 'days_before_date'
    - This allows automation rules to trigger X days BEFORE a date field
    
  2. New Trigger Type
    - 'days_before_date': Triggers X days before a specified date field reaches a value
    - Example: "Send reminder 7 days before project end date"
*/

ALTER TABLE automation_rules 
DROP CONSTRAINT IF EXISTS automation_rules_trigger_type_check;

ALTER TABLE automation_rules 
ADD CONSTRAINT automation_rules_trigger_type_check 
CHECK (trigger_type = ANY (ARRAY[
  'hkpc_date_set'::text,
  'task_completed'::text,
  'status_changed'::text,
  'periodic'::text,
  'deposit_paid'::text,
  'days_after_date'::text,
  'days_before_date'::text,
  'application_number_set'::text,
  'approval_date_set'::text,
  'label_added'::text
]));
