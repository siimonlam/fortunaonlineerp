/*
  # Fix Social Post Step to Task Sync

  1. Changes
    - Fix sync_social_post_step_to_task() to use `completed` boolean instead of `status` text
    - Map step status correctly: 'completed' -> true, others -> false

  2. Purpose
    - Ensure social post steps sync correctly to marketing_tasks
    - Only non-completed steps show up in "My Tasks"
*/

-- Drop and recreate the sync function with correct field mappings
CREATE OR REPLACE FUNCTION sync_social_post_step_to_task()
RETURNS TRIGGER AS $$
DECLARE
  v_post_title text;
  v_task_title text;
  v_task_completed boolean;
BEGIN
  -- Get post title
  SELECT title INTO v_post_title
  FROM marketing_social_posts
  WHERE id = NEW.post_id;

  -- Create task title
  v_task_title := v_post_title || ' - ' || NEW.step_name;

  -- Map step status to task completed boolean
  v_task_completed := (NEW.status = 'completed');

  -- Insert or update marketing_tasks
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
  WHERE msp.id = NEW.post_id
  ON CONFLICT (related_post_step_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    assigned_to = EXCLUDED.assigned_to,
    completed = EXCLUDED.completed,
    deadline = EXCLUDED.deadline,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
