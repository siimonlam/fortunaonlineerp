/*
  # Fix marketing_tasks.assigned_to to reference staff table

  ## Problem
  - marketing_tasks.assigned_to references auth.users (different schema)
  - PostgREST can't create relationships across schemas
  - Causes error: "Could not find a relationship between 'marketing_tasks' and 'assigned_to'"

  ## Solution
  - Drop the auth.users foreign key
  - Add foreign key to staff table (same as regular tasks table)
  - This allows PostgREST to expose the relationship
*/

-- Drop the existing foreign key to auth.users
ALTER TABLE marketing_tasks
DROP CONSTRAINT IF EXISTS marketing_tasks_assigned_to_fkey;

-- Add foreign key to staff table instead
ALTER TABLE marketing_tasks
ADD CONSTRAINT marketing_tasks_assigned_to_fkey
FOREIGN KEY (assigned_to)
REFERENCES staff(id)
ON DELETE SET NULL;
