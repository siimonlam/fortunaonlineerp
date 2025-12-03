/*
  # Migrate Marketing Projects Data

  1. Purpose
    - Copy all existing marketing projects from projects table to marketing_projects table
    - Preserve all data including relationships and metadata

  2. Migration Process
    - Insert marketing projects into marketing_projects table
    - Keep original IDs for referential integrity
    - Copy all relevant fields

  3. Note
    - Does not delete from projects table yet (can be done manually after verification)
*/

-- Migrate marketing projects from projects to marketing_projects
INSERT INTO marketing_projects (
  id,
  title,
  description,
  status_id,
  created_by,
  client_id,
  company_name,
  company_name_chinese,
  contact_name,
  contact_number,
  email,
  address,
  sales_person_id,
  sales_source,
  sales_source_detail,
  project_name,
  google_drive_folder_id,
  created_at,
  updated_at
)
SELECT 
  p.id,
  p.title,
  p.description,
  p.status_id,
  p.created_by,
  p.client_id,
  p.company_name,
  p.company_name_chinese,
  p.contact_name,
  p.contact_number,
  p.email,
  p.address,
  p.sales_person_id,
  p.sales_source,
  (SELECT sales_source_detail FROM clients c WHERE c.id = p.client_id LIMIT 1) as sales_source_detail,
  p.project_name,
  p.google_drive_folder_id,
  p.created_at,
  p.updated_at
FROM projects p
JOIN project_types pt ON p.project_type_id = pt.id
WHERE pt.name = 'Marketing'
ON CONFLICT (id) DO NOTHING;
