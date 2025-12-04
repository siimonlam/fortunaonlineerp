/*
  # Add Execution Frequency to Periodic Automations

  1. Changes
    - Add `execution_frequency_days` field to `automation_rules` table
      - Defines how often the automation rule itself runs (1 = daily, 2 = every 2 days, etc.)
      - This is separate from the action frequency (N days from start date)

  2. Notes
    - Default to 1 (daily execution) for existing rules
    - Allows optimization: a 30-day action doesn't need daily checks
    - Example: execution_frequency_days=7 means check weekly, action_frequency=30 means trigger on days 30, 60, 90...
*/

-- Add execution_frequency_days field to automation_rules
ALTER TABLE automation_rules
ADD COLUMN IF NOT EXISTS execution_frequency_days integer DEFAULT 1 CHECK (execution_frequency_days >= 1);

-- Add comment explaining the two frequencies
COMMENT ON COLUMN automation_rules.execution_frequency_days IS 'How often the automation runs (1=daily, 2=every 2 days, etc.). Separate from action frequency in conditions.';