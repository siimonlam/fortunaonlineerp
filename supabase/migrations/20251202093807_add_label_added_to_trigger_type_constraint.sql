/*
  # Add label_added to automation_rules trigger_type constraint

  1. Changes
    - Drop existing check constraint on trigger_type
    - Add new constraint that includes 'label_added'

  2. Purpose
    - Allow automation rules to be created with 'label_added' trigger type
*/

-- Drop the existing constraint
ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_trigger_type_check;

-- Add new constraint with label_added included
ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_trigger_type_check 
  CHECK (trigger_type IN (
    'hkpc_date_set', 
    'task_completed', 
    'status_changed', 
    'periodic', 
    'days_after_date', 
    'deposit_paid', 
    'application_number_set', 
    'approval_date_set',
    'label_added'
  ));
