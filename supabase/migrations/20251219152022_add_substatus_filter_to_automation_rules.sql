/*
  # Add Substatus Filter to Automation Rules

  1. Changes
    - Add `substatus_filter` column to automation_rules table
      - Stores which substatus to filter on (null or 'All' means all substatuses)
      - Allows targeting specific substatuses for better performance
    
  2. Purpose
    - Enable automation rules to target specific substatuses of a main status
    - Improve filtering performance by narrowing the scope
    - Default all existing rules to 'All' for backward compatibility
*/

-- Add substatus_filter column to automation_rules
ALTER TABLE automation_rules 
ADD COLUMN IF NOT EXISTS substatus_filter text DEFAULT 'All';

-- Update all existing rules to have 'All' as default
UPDATE automation_rules 
SET substatus_filter = 'All' 
WHERE substatus_filter IS NULL;
