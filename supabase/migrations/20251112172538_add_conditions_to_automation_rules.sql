/*
  # Add Condition Support to Automation Rules

  1. Changes
    - Add `condition_type` column to specify the type of condition (no_condition, sales_source, sales_person)
    - Add `condition_config` jsonb column to store condition parameters (e.g., which sales_source or sales_person)
    
  2. Notes
    - condition_type defaults to 'no_condition' for backward compatibility
    - condition_config stores the specific values for the condition
*/

-- Add condition columns to automation_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automation_rules' AND column_name = 'condition_type'
  ) THEN
    ALTER TABLE automation_rules 
    ADD COLUMN condition_type text DEFAULT 'no_condition' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automation_rules' AND column_name = 'condition_config'
  ) THEN
    ALTER TABLE automation_rules 
    ADD COLUMN condition_config jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add comment to explain condition types
COMMENT ON COLUMN automation_rules.condition_type IS 'Type of condition: no_condition, sales_source, sales_person';
COMMENT ON COLUMN automation_rules.condition_config IS 'Configuration for the condition, e.g., {"sales_source": "value"} or {"sales_person_id": "uuid"}';
