/*
  # Add urgent flag to tasks

  1. Changes
    - Add `is_urgent` boolean column to `tasks` table with default false
    - Add index for efficient sorting by urgent status
  
  2. Purpose
    - Allow users to mark tasks as urgent
    - Enable sorting urgent tasks to the top of task lists
*/

-- Add is_urgent column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_urgent boolean DEFAULT false NOT NULL;

-- Add index for efficient filtering and sorting by urgent status
CREATE INDEX IF NOT EXISTS idx_tasks_is_urgent ON tasks(is_urgent);

-- Add comment for documentation
COMMENT ON COLUMN tasks.is_urgent IS 'Flag to mark tasks as urgent. Urgent tasks will be sorted to the top of task lists.';
