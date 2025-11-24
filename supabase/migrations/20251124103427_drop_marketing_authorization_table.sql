/*
  # Drop Marketing Authorization Table

  1. Changes
    - Drop marketing_authorization table (not needed, using project_type_permissions instead)
*/

-- Drop the marketing_authorization table
DROP TABLE IF EXISTS marketing_authorization CASCADE;