/*
  # Add Links Field to Marketing Tasks

  1. Changes
    - Add `links` field to `marketing_tasks` table (text, optional)
    - This field can store URLs or links related to the task
*/

-- Add links column to marketing_tasks
ALTER TABLE marketing_tasks ADD COLUMN IF NOT EXISTS links text;
