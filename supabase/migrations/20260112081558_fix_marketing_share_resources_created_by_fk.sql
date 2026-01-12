/*
  # Fix Marketing Share Resources Created By Foreign Key

  1. Changes
    - Drop the foreign key constraint on created_by that references auth.users
    - Add a new foreign key constraint that references the staff table
    - This allows PostgREST to properly embed the relationship

  2. Security
    - No changes to RLS policies needed
*/

-- Drop the existing foreign key constraint
ALTER TABLE marketing_share_resources
DROP CONSTRAINT IF EXISTS marketing_share_resources_created_by_fkey;

-- Add new foreign key constraint to staff table
ALTER TABLE marketing_share_resources
ADD CONSTRAINT marketing_share_resources_created_by_fkey
FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL;
