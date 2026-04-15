/*
  # Add Recurring Task Fields

  ## Summary
  Adds recurring task support to both `tasks` and `marketing_tasks` tables.

  ## New Columns (both tables)
  - `is_recurring` (boolean, default false) - whether this task repeats
  - `recurrence_type` (text, nullable) - 'daily', 'weekly', or 'monthly'
  - `recurrence_interval` (integer, default 1) - every N days/weeks/months
  - `parent_task_id` (uuid, nullable) - references the original task this was spawned from

  ## Behavior
  When a recurring task is completed, a new instance is automatically created
  with the deadline advanced by the recurrence interval.

  ## Security
  No new RLS required — new columns inherit existing table policies.
*/

DO $$
BEGIN
  -- tasks table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE tasks ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'recurrence_type'
  ) THEN
    ALTER TABLE tasks ADD COLUMN recurrence_type text CHECK (recurrence_type IN ('daily', 'weekly', 'monthly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'recurrence_interval'
  ) THEN
    ALTER TABLE tasks ADD COLUMN recurrence_interval integer NOT NULL DEFAULT 1 CHECK (recurrence_interval > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'parent_task_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN parent_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
  END IF;

  -- marketing_tasks table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_tasks' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE marketing_tasks ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_tasks' AND column_name = 'recurrence_type'
  ) THEN
    ALTER TABLE marketing_tasks ADD COLUMN recurrence_type text CHECK (recurrence_type IN ('daily', 'weekly', 'monthly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_tasks' AND column_name = 'recurrence_interval'
  ) THEN
    ALTER TABLE marketing_tasks ADD COLUMN recurrence_interval integer NOT NULL DEFAULT 1 CHECK (recurrence_interval > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_tasks' AND column_name = 'parent_task_id'
  ) THEN
    ALTER TABLE marketing_tasks ADD COLUMN parent_task_id uuid REFERENCES marketing_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;
