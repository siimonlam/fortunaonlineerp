/*
  # Add completed_at tracking to tasks

  1. Changes
    - Add `completed_at` column to `tasks` table
    - Add `completed_at` column to `marketing_tasks` table
    - Backfill `completed_at` for existing completed tasks using `updated_at`
  
  2. Purpose
    - Track when tasks are actually completed
    - Enable time-based completion analytics and leaderboards
*/

-- Add completed_at column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Add completed_at column to marketing_tasks table
ALTER TABLE marketing_tasks 
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill completed_at for existing completed tasks
UPDATE tasks 
SET completed_at = updated_at 
WHERE completed = true AND completed_at IS NULL;

UPDATE marketing_tasks 
SET completed_at = updated_at 
WHERE completed = true AND completed_at IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed = true;
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_completed_at ON marketing_tasks(completed_at) WHERE completed = true;
