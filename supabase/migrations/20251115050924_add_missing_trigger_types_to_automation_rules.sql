/*
  # Add missing trigger types to automation rules

  1. Changes
    - Update the trigger_type check constraint to include 'deposit_paid' and 'days_after_date'
    - This allows automation rules to trigger on deposit payment and date-based events

  2. Notes
    - Drops and recreates the constraint with all supported trigger types
*/

-- Drop the old constraint
ALTER TABLE automation_rules
DROP CONSTRAINT IF EXISTS automation_rules_trigger_type_check;

-- Add the updated constraint with all trigger types
ALTER TABLE automation_rules
ADD CONSTRAINT automation_rules_trigger_type_check
CHECK (trigger_type = ANY (ARRAY['hkpc_date_set'::text, 'task_completed'::text, 'status_changed'::text, 'periodic'::text, 'deposit_paid'::text, 'days_after_date'::text]));