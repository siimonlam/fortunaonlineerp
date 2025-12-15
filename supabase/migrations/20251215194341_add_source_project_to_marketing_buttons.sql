/*
  # Add Source Project to Marketing Project Buttons

  1. Changes
    - Add `source_project_id` to `marketing_project_buttons` table
      - Links to the marketing_projects table
      - Indicates which project card the button should appear on
      - NULL means the button appears globally (sidebar)

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add source_project_id column
ALTER TABLE marketing_project_buttons
ADD COLUMN IF NOT EXISTS source_project_id uuid REFERENCES marketing_projects(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_marketing_project_buttons_source_project
  ON marketing_project_buttons(source_project_id);

-- Update existing buttons to be global (NULL source_project_id)
UPDATE marketing_project_buttons
SET source_project_id = NULL
WHERE source_project_id IS NULL;
