/*
  # Enforce Daily Execution for Periodic Automation Rules

  1. Changes
    - Add trigger to automatically set execution_frequency_days = 1 for periodic rules
    - Ensures all periodic automation rules check daily
    - Action execution frequency is controlled by trigger_config.frequency (Action Frequency N days)

  2. Notes
    - Periodic rules always check daily (execution_frequency_days = 1)
    - Actual action execution depends on Action Frequency (e.g., 20, 30, 45 days)
    - From Start Date, actions execute every N days: day 20, 40, 60, etc.
*/

-- Create trigger function to enforce execution_frequency_days = 1 for periodic rules
CREATE OR REPLACE FUNCTION enforce_periodic_daily_execution()
RETURNS TRIGGER AS $$
BEGIN
  -- If trigger_type is 'periodic', force execution_frequency_days to 1
  IF NEW.trigger_type = 'periodic' THEN
    NEW.execution_frequency_days := 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS enforce_periodic_daily_execution_insert ON automation_rules;
CREATE TRIGGER enforce_periodic_daily_execution_insert
  BEFORE INSERT ON automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION enforce_periodic_daily_execution();

-- Create trigger for UPDATE operations
DROP TRIGGER IF EXISTS enforce_periodic_daily_execution_update ON automation_rules;
CREATE TRIGGER enforce_periodic_daily_execution_update
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW
  WHEN (NEW.trigger_type = 'periodic')
  EXECUTE FUNCTION enforce_periodic_daily_execution();
