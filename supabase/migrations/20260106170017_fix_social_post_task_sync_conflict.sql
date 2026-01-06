/*
  # Fix Social Post Task Sync ON CONFLICT Issue

  1. Changes
    - Update sync_social_post_step_to_task function to handle unique constraint properly
    - Use DO NOTHING and separate update logic instead of ON CONFLICT DO UPDATE
  
  2. Purpose
    - Fix "no unique or exclusion constraint matching" error when creating posts
*/

-- Drop and recreate the sync function with proper conflict handling
CREATE OR REPLACE FUNCTION sync_social_post_step_to_task()
RETURNS TRIGGER AS $$
DECLARE
  v_post_title text;
  v_task_title text;
  v_task_status text;
  v_existing_task_id uuid;
BEGIN
  -- Get post title
  SELECT title INTO v_post_title
  FROM marketing_social_posts
  WHERE id = NEW.post_id;

  -- Create task title
  v_task_title := v_post_title || ' - ' || NEW.step_name;

  -- Map step status to task status
  IF NEW.status = 'completed' THEN
    v_task_status := 'completed';
  ELSIF NEW.status = 'in_progress' THEN
    v_task_status := 'in_progress';
  ELSE
    v_task_status := 'pending';
  END IF;

  -- Check if task already exists for this step
  SELECT id INTO v_existing_task_id
  FROM marketing_tasks
  WHERE related_post_step_id = NEW.id;

  IF v_existing_task_id IS NOT NULL THEN
    -- Update existing task
    UPDATE marketing_tasks
    SET 
      title = v_task_title,
      assigned_to = NEW.assigned_to,
      status = v_task_status,
      due_date = NEW.due_date,
      updated_at = now()
    WHERE id = v_existing_task_id;
  ELSE
    -- Insert new task
    INSERT INTO marketing_tasks (
      marketing_project_id,
      title,
      description,
      assigned_to,
      status,
      due_date,
      related_post_step_id
    )
    SELECT 
      msp.marketing_project_id,
      v_task_title,
      'Social Media Post: Step ' || NEW.step_number::text,
      NEW.assigned_to,
      v_task_status,
      NEW.due_date,
      NEW.id
    FROM marketing_social_posts msp
    WHERE msp.id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;