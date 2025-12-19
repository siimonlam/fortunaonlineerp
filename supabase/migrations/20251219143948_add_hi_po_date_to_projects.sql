/*
  # Add Hi-Po Date Tracking to Projects

  1. New Fields
    - Add `hi_po_date` (date) to projects table
    - Records the date when a project first becomes Hi-Po status
  
  2. Triggers
    - On new funding project creation: Set hi_po_date to today
    - On status change to Hi-Po (any substatus): Set hi_po_date to today if not already set
  
  3. Logic
    - The date is set when:
      a) A new funding project is created (client onboarding flow)
      b) A project status is manually changed to any Hi-Po substatus
    - Once set, the date is preserved (won't be overwritten)
*/

-- Add hi_po_date field to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS hi_po_date date;

-- Create function to set hi_po_date when appropriate
CREATE OR REPLACE FUNCTION set_hi_po_date()
RETURNS TRIGGER AS $$
DECLARE
  v_hipo_parent_id uuid;
  v_is_hipo_status boolean := false;
BEGIN
  -- Get the Hi-Po parent status ID for Funding Projects
  SELECT id INTO v_hipo_parent_id
  FROM statuses
  WHERE name = 'Hi-Po' 
    AND parent_status_id IS NULL
    AND project_type_id = '49c17e80-db14-4e13-b03f-537771270696';

  -- Check if the new status is Hi-Po or any of its substatuses
  IF NEW.status_id IS NOT NULL THEN
    SELECT 
      (s.id = v_hipo_parent_id OR s.parent_status_id = v_hipo_parent_id)
    INTO v_is_hipo_status
    FROM statuses s
    WHERE s.id = NEW.status_id;
  END IF;

  -- If inserting a new funding project, set hi_po_date to today
  IF TG_OP = 'INSERT' AND NEW.project_type_id = '49c17e80-db14-4e13-b03f-537771270696' THEN
    NEW.hi_po_date := CURRENT_DATE;
  
  -- If updating to Hi-Po status and hi_po_date is not set, set it to today
  ELSIF TG_OP = 'UPDATE' AND v_is_hipo_status AND NEW.hi_po_date IS NULL THEN
    NEW.hi_po_date := CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_hi_po_date ON projects;

-- Create trigger that fires before insert or update
CREATE TRIGGER trigger_set_hi_po_date
  BEFORE INSERT OR UPDATE OF status_id
  ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_hi_po_date();
