/*
  # Add Granted Amount to Projects

  1. Changes
    - Add `granted_amount` column to `projects` table
    - This field stores the approved/granted funding amount
*/

-- Add granted_amount column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS granted_amount text;

COMMENT ON COLUMN projects.granted_amount IS 'The approved/granted funding amount for the project';