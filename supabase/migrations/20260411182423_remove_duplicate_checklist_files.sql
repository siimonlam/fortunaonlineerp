
/*
  # Remove duplicate project_checklist_files rows

  Keeps the oldest row for each (file_id, drive_folder_id) pair and deletes
  any newer duplicates, along with their associated file checks.
*/

DELETE FROM project_checklist_file_checks
WHERE file_id IN (
  SELECT id FROM project_checklist_files
  WHERE id NOT IN (
    SELECT DISTINCT ON (file_id, drive_folder_id) id
    FROM project_checklist_files
    WHERE drive_folder_id IS NOT NULL
    ORDER BY file_id, drive_folder_id, created_at ASC
  )
  AND drive_folder_id IS NOT NULL
);

DELETE FROM project_checklist_files
WHERE id NOT IN (
  SELECT DISTINCT ON (file_id, drive_folder_id) id
  FROM project_checklist_files
  WHERE drive_folder_id IS NOT NULL
  ORDER BY file_id, drive_folder_id, created_at ASC
)
AND drive_folder_id IS NOT NULL;
