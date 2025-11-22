/*
  # Update Project Title Format with Hyphen

  1. Changes
    - Modify `update_project_title()` function to use hyphen separator
    - Format: "Company Name - Project Name"
*/

-- Update function to use hyphen separator
CREATE OR REPLACE FUNCTION update_project_title()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Concatenate company_name and project_name with " - "
  -- Handle NULL values gracefully
  IF NEW.company_name IS NOT NULL AND NEW.project_name IS NOT NULL THEN
    NEW.title := NEW.company_name || ' - ' || NEW.project_name;
  ELSIF NEW.company_name IS NOT NULL THEN
    NEW.title := NEW.company_name;
  ELSIF NEW.project_name IS NOT NULL THEN
    NEW.title := NEW.project_name;
  ELSE
    NEW.title := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;
