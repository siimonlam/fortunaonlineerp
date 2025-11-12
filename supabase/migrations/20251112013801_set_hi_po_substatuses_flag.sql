/*
  # Set Hi-Po Substatuses Flag

  1. Updates
    - Set is_substatus = true for all Hi-Po substatuses
    - This ensures they don't appear as independent buttons in the sidebar
    - They will only appear under the Hi-Po expandable section

  2. Affected Records
    - Hi-Po (substatus)
    - Mi-Po
    - Lo-Po
    - Cold Call
*/

-- Update all Hi-Po substatuses to have is_substatus = true
UPDATE statuses
SET is_substatus = true
WHERE parent_status_id = (
  SELECT id FROM statuses
  WHERE name = 'Hi-Po'
    AND parent_status_id IS NULL
    AND project_type_id = (
      SELECT id FROM project_types WHERE name = 'Funding Project'
    )
);
