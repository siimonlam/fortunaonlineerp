/*
  # Fix project_staff Table Structure

  1. Changes
    - Add `user_id` column (alias for staff_id for backwards compatibility)
    - Add `can_view` column (boolean, default true)
    - Add `can_edit` column (boolean, default false)
    - Keep existing `staff_id` column for database consistency

  2. Purpose
    - Match frontend expectations for project_staff query
    - Enable granular permissions for Marketing project sharing
*/

-- Add missing columns to project_staff table
DO $$ 
BEGIN
  -- Add user_id column (copy of staff_id for compatibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_staff' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE project_staff ADD COLUMN user_id uuid REFERENCES staff(id) ON DELETE CASCADE;
    -- Copy existing staff_id values to user_id
    UPDATE project_staff SET user_id = staff_id;
    -- Make it not null after copying data
    ALTER TABLE project_staff ALTER COLUMN user_id SET NOT NULL;
  END IF;

  -- Add can_view column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_staff' AND column_name = 'can_view'
  ) THEN
    ALTER TABLE project_staff ADD COLUMN can_view boolean DEFAULT true NOT NULL;
  END IF;

  -- Add can_edit column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_staff' AND column_name = 'can_edit'
  ) THEN
    ALTER TABLE project_staff ADD COLUMN can_edit boolean DEFAULT false NOT NULL;
  END IF;
END $$;
