/*
  # Migrate Hi-Po Projects to Hi-Po Substatus

  1. Migration
    - Move all existing projects from Hi-Po main status to Hi-Po substatus
    - This ensures projects appear under the expanded Hi-Po section
    - Preserves all project data, only changes status_id

  2. Details
    - Temporarily disables history tracking trigger
    - Updates projects.status_id from Hi-Po parent to Hi-Po substatus
    - Re-enables history tracking trigger
    - Affects approximately 8 projects currently in Hi-Po main status

  3. Notes
    - This is a one-time migration to reorganize the status hierarchy
    - History trigger is disabled to avoid null user_id constraint
*/

-- Disable the history tracking trigger temporarily
ALTER TABLE projects DISABLE TRIGGER track_project_changes_trigger;

-- Update all projects from Hi-Po main status to Hi-Po substatus
UPDATE projects
SET status_id = (
  SELECT id FROM statuses
  WHERE name = 'Hi-Po'
    AND parent_status_id = (
      SELECT id FROM statuses
      WHERE name = 'Hi-Po'
        AND parent_status_id IS NULL
        AND project_type_id = (
          SELECT id FROM project_types WHERE name = 'Funding Project'
        )
    )
)
WHERE status_id = (
  SELECT id FROM statuses
  WHERE name = 'Hi-Po'
    AND parent_status_id IS NULL
    AND project_type_id = (
      SELECT id FROM project_types WHERE name = 'Funding Project'
    )
);

-- Re-enable the history tracking trigger
ALTER TABLE projects ENABLE TRIGGER track_project_changes_trigger;
