/*
  # Add Funding Scheme Field to Projects

  1. Changes
    - Add `funding_scheme` column to `projects` table
    - Set default value to 25 (representing 25%)
    - Column is numeric to store percentage values
*/

-- Add funding_scheme column with default 25
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS funding_scheme numeric DEFAULT 25;
