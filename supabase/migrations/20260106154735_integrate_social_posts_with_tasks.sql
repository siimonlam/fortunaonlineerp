/*
  # Integrate Social Media Posts with Marketing Tasks

  1. Changes
    - Add function to create/update marketing tasks for social post steps
    - Add trigger to sync social post steps with marketing_tasks
  
  2. Purpose
    - Social media post steps appear as tasks in "My Tasks"
    - Tasks are automatically created/updated when steps change
*/

-- Function to sync social post step to marketing task
CREATE OR REPLACE FUNCTION sync_social_post_step_to_task()
RETURNS TRIGGER AS $$
DECLARE
  v_post_title text;
  v_task_title text;
  v_task_status text;
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

  -- Insert or update marketing_tasks
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
  WHERE msp.id = NEW.post_id
  ON CONFLICT (related_post_step_id) 
  DO UPDATE SET
    title = EXCLUDED.title,
    assigned_to = EXCLUDED.assigned_to,
    status = EXCLUDED.status,
    due_date = EXCLUDED.due_date,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add related_post_step_id column to marketing_tasks if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_tasks' AND column_name = 'related_post_step_id'
  ) THEN
    ALTER TABLE marketing_tasks ADD COLUMN related_post_step_id uuid REFERENCES marketing_social_post_steps(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX idx_marketing_tasks_post_step ON marketing_tasks(related_post_step_id) WHERE related_post_step_id IS NOT NULL;
    CREATE INDEX idx_marketing_tasks_related_post_step ON marketing_tasks(related_post_step_id);
  END IF;
END $$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_sync_social_post_step_to_task ON marketing_social_post_steps;
CREATE TRIGGER trigger_sync_social_post_step_to_task
  AFTER INSERT OR UPDATE ON marketing_social_post_steps
  FOR EACH ROW
  EXECUTE FUNCTION sync_social_post_step_to_task();
