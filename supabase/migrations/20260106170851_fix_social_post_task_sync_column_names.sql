/*
  # Fix Social Post Task Sync Column Names

  1. Changes
    - Update sync_social_post_step_to_task to use correct marketing_tasks columns
    - Use `completed` (boolean) instead of `status` (text)
    - Use `deadline` instead of `due_date`
  
  2. Purpose
    - Fix "column status does not exist" error when creating social posts
*/

-- Update the sync function to use correct column names
CREATE OR REPLACE FUNCTION sync_social_post_step_to_task()
RETURNS TRIGGER AS $$
DECLARE
  v_post_title text;
  v_task_title text;
  v_task_completed boolean;
  v_existing_task_id uuid;
BEGIN
  -- Get post title
  SELECT title INTO v_post_title
  FROM marketing_social_posts
  WHERE id = NEW.post_id;

  -- Create task title
  v_task_title := v_post_title || ' - ' || NEW.step_name;

  -- Map step status to task completed boolean
  IF NEW.status = 'completed' THEN
    v_task_completed := true;
  ELSE
    v_task_completed := false;
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
      completed = v_task_completed,
      deadline = NEW.due_date,
      updated_at = now()
    WHERE id = v_existing_task_id;
  ELSE
    -- Insert new task
    INSERT INTO marketing_tasks (
      marketing_project_id,
      title,
      description,
      assigned_to,
      completed,
      deadline,
      related_post_step_id
    )
    SELECT 
      msp.marketing_project_id,
      v_task_title,
      'Social Media Post: Step ' || NEW.step_number::text,
      NEW.assigned_to,
      v_task_completed,
      NEW.due_date,
      NEW.id
    FROM marketing_social_posts msp
    WHERE msp.id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;