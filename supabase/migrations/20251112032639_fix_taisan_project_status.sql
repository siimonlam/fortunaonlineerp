/*
  # Fix TaiSan Project Status

  1. Updates
    - Update TaiSan project (FP00013) to use Hi-Po substatus
    - Moves project from Hi-Po parent to Hi-Po substatus
    - This is a fix for a project created before the substatus system was in place

  2. Details
    - Temporarily disables history tracking trigger
    - Updates the project status
    - Re-enables history tracking trigger
*/

-- Disable the history tracking trigger temporarily
ALTER TABLE projects DISABLE TRIGGER track_project_changes_trigger;

-- Update TaiSan project to use Hi-Po substatus
UPDATE projects
SET status_id = '40619c4e-de11-474e-95fc-ad5dcbd84a68'
WHERE id = 'dafdc25a-d099-4aa9-8c48-4af31532c422';

-- Re-enable the history tracking trigger
ALTER TABLE projects ENABLE TRIGGER track_project_changes_trigger;
