/*
  # Add Post ID to Marketing Social Posts

  1. Schema Changes
    - Add `post_id` column to `marketing_social_posts` table
    - Format: `{project_reference}_{yyyymmdd}_{XXXX}`
    - XXXX is a sequential number starting from 0001, incremented per day per project
    
  2. Automation
    - Create function to generate post ID
    - Create trigger to auto-generate post ID on insert
    - Counter resets daily for each project
    
  3. Examples
    - MK001_20260109_0001
    - MK001_20260109_0002
    - MK001_20260110_0001 (new day, counter resets)
*/

-- Add post_id column
ALTER TABLE marketing_social_posts
ADD COLUMN IF NOT EXISTS post_id TEXT;

-- Create function to generate post ID
CREATE OR REPLACE FUNCTION generate_social_post_id()
RETURNS TRIGGER AS $$
DECLARE
  project_ref TEXT;
  today_str TEXT;
  counter INT;
  new_post_id TEXT;
BEGIN
  -- Get project reference from marketing project
  SELECT project_reference INTO project_ref
  FROM marketing_projects
  WHERE id = NEW.marketing_project_id;
  
  -- Use a default if no project reference exists
  IF project_ref IS NULL OR project_ref = '' THEN
    project_ref := 'POST';
  END IF;
  
  -- Get today's date in yyyymmdd format
  today_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Count existing posts for this project created today
  SELECT COUNT(*) + 1 INTO counter
  FROM marketing_social_posts
  WHERE marketing_project_id = NEW.marketing_project_id
    AND DATE(created_at) = CURRENT_DATE
    AND id != NEW.id;
  
  -- Generate post_id
  new_post_id := project_ref || '_' || today_str || '_' || LPAD(counter::TEXT, 4, '0');
  
  -- Assign to NEW record
  NEW.post_id := new_post_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate post ID
DROP TRIGGER IF EXISTS trigger_generate_social_post_id ON marketing_social_posts;

CREATE TRIGGER trigger_generate_social_post_id
  BEFORE INSERT ON marketing_social_posts
  FOR EACH ROW
  EXECUTE FUNCTION generate_social_post_id();

-- Backfill existing posts with post IDs
DO $$
DECLARE
  post_record RECORD;
  project_ref TEXT;
  date_str TEXT;
  counter INT;
  new_post_id TEXT;
BEGIN
  FOR post_record IN 
    SELECT id, marketing_project_id, created_at
    FROM marketing_social_posts
    WHERE post_id IS NULL
    ORDER BY created_at
  LOOP
    -- Get project reference
    SELECT project_reference INTO project_ref
    FROM marketing_projects
    WHERE id = post_record.marketing_project_id;
    
    IF project_ref IS NULL OR project_ref = '' THEN
      project_ref := 'POST';
    END IF;
    
    -- Get date in yyyymmdd format
    date_str := TO_CHAR(post_record.created_at, 'YYYYMMDD');
    
    -- Count posts for this project on this date that were created before this one
    SELECT COUNT(*) + 1 INTO counter
    FROM marketing_social_posts
    WHERE marketing_project_id = post_record.marketing_project_id
      AND DATE(created_at) = DATE(post_record.created_at)
      AND created_at < post_record.created_at
      AND post_id IS NOT NULL;
    
    -- Generate post_id
    new_post_id := project_ref || '_' || date_str || '_' || LPAD(counter::TEXT, 4, '0');
    
    -- Update the record
    UPDATE marketing_social_posts
    SET post_id = new_post_id
    WHERE id = post_record.id;
  END LOOP;
END $$;
