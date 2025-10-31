/*
  # Remove Unique Constraint and Add Sub-Status Support

  1. Schema Changes
    - Drop unique constraint on statuses.name (to allow duplicate names for sub-statuses)
    - Add `parent_status_id` column to support hierarchical statuses
    - Add `is_substatus` boolean to identify sub-statuses
    
  2. Rationale
    - Main statuses and sub-statuses can have the same name
    - For example: "Q&A" is both a main status and a sub-status under "Q&A"
    - "Final Report" is both a main status and a sub-status under "Final Report"
*/

-- Drop the unique constraint on name
ALTER TABLE statuses DROP CONSTRAINT IF EXISTS statuses_name_key;

-- Add columns to support sub-statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'statuses' AND column_name = 'parent_status_id'
  ) THEN
    ALTER TABLE statuses ADD COLUMN parent_status_id uuid REFERENCES statuses(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'statuses' AND column_name = 'is_substatus'
  ) THEN
    ALTER TABLE statuses ADD COLUMN is_substatus boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_statuses_parent_status_id ON statuses(parent_status_id);
CREATE INDEX IF NOT EXISTS idx_statuses_is_substatus ON statuses(is_substatus);

-- Create a composite unique constraint: name must be unique within a project_type and parent combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_statuses_unique_name_per_parent 
ON statuses(name, project_type_id, COALESCE(parent_status_id, '00000000-0000-0000-0000-000000000000'::uuid));
