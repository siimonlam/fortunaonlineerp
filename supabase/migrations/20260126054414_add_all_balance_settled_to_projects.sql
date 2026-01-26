/*
  # Add all_balance_settled field to projects

  1. Changes
    - Add `all_balance_settled` boolean field to `projects` table
    - Defaults to false
    - When true, the receivable amount should be treated as 0
  
  2. Purpose
    - Allow manual override to mark a project as fully settled
    - Useful for cases where balance is settled outside normal invoice tracking
*/

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS all_balance_settled boolean DEFAULT false;
