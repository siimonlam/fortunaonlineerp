/*
  # Create Recurring Task Auto-Spawn Triggers

  ## Summary
  When a recurring task is marked as completed, a database trigger automatically
  creates the next occurrence with the deadline advanced by the recurrence interval.

  ## Functions Created
  - `spawn_next_recurring_task()` - handles tasks table
  - `spawn_next_recurring_marketing_task()` - handles marketing_tasks table

  ## Triggers Created
  - `trg_spawn_next_recurring_task` on tasks (AFTER UPDATE)
  - `trg_spawn_next_recurring_marketing_task` on marketing_tasks (AFTER UPDATE)

  ## Logic
  - Only fires when `completed` changes from false → true
  - Only fires if `is_recurring = true` and `recurrence_type` is set
  - Calculates next deadline based on type and interval
  - New task inherits all fields but starts as incomplete
  - `parent_task_id` links back to the original template task
*/

-- Function for tasks table
CREATE OR REPLACE FUNCTION spawn_next_recurring_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_deadline timestamptz;
  base_deadline timestamptz;
BEGIN
  -- Only act when task was just completed and is a recurring task
  IF NEW.completed = true AND OLD.completed = false
     AND NEW.is_recurring = true
     AND NEW.recurrence_type IS NOT NULL
  THEN
    -- Use existing deadline as base, or NOW() if no deadline
    base_deadline := COALESCE(NEW.deadline, NOW());

    -- Calculate the next deadline
    IF NEW.recurrence_type = 'daily' THEN
      next_deadline := base_deadline + (NEW.recurrence_interval || ' days')::interval;
    ELSIF NEW.recurrence_type = 'weekly' THEN
      next_deadline := base_deadline + (NEW.recurrence_interval * 7 || ' days')::interval;
    ELSIF NEW.recurrence_type = 'monthly' THEN
      next_deadline := base_deadline + (NEW.recurrence_interval || ' months')::interval;
    ELSE
      RETURN NEW;
    END IF;

    -- Insert the next occurrence
    INSERT INTO tasks (
      project_id,
      title,
      description,
      assigned_to,
      deadline,
      is_urgent,
      is_recurring,
      recurrence_type,
      recurrence_interval,
      parent_task_id,
      completed,
      created_at,
      updated_at
    ) VALUES (
      NEW.project_id,
      NEW.title,
      NEW.description,
      NEW.assigned_to,
      next_deadline,
      NEW.is_urgent,
      true,
      NEW.recurrence_type,
      NEW.recurrence_interval,
      COALESCE(NEW.parent_task_id, NEW.id),
      false,
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger for tasks
DROP TRIGGER IF EXISTS trg_spawn_next_recurring_task ON tasks;
CREATE TRIGGER trg_spawn_next_recurring_task
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION spawn_next_recurring_task();


-- Function for marketing_tasks table
CREATE OR REPLACE FUNCTION spawn_next_recurring_marketing_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_deadline timestamptz;
  base_deadline timestamptz;
BEGIN
  IF NEW.completed = true AND OLD.completed = false
     AND NEW.is_recurring = true
     AND NEW.recurrence_type IS NOT NULL
  THEN
    base_deadline := COALESCE(NEW.deadline, NOW());

    IF NEW.recurrence_type = 'daily' THEN
      next_deadline := base_deadline + (NEW.recurrence_interval || ' days')::interval;
    ELSIF NEW.recurrence_type = 'weekly' THEN
      next_deadline := base_deadline + (NEW.recurrence_interval * 7 || ' days')::interval;
    ELSIF NEW.recurrence_type = 'monthly' THEN
      next_deadline := base_deadline + (NEW.recurrence_interval || ' months')::interval;
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO marketing_tasks (
      marketing_project_id,
      title,
      description,
      links,
      assigned_to,
      deadline,
      is_urgent,
      is_recurring,
      recurrence_type,
      recurrence_interval,
      parent_task_id,
      completed,
      created_at,
      updated_at
    ) VALUES (
      NEW.marketing_project_id,
      NEW.title,
      NEW.description,
      NEW.links,
      NEW.assigned_to,
      next_deadline,
      NEW.is_urgent,
      true,
      NEW.recurrence_type,
      NEW.recurrence_interval,
      COALESCE(NEW.parent_task_id, NEW.id),
      false,
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger for marketing_tasks
DROP TRIGGER IF EXISTS trg_spawn_next_recurring_marketing_task ON marketing_tasks;
CREATE TRIGGER trg_spawn_next_recurring_marketing_task
  AFTER UPDATE ON marketing_tasks
  FOR EACH ROW
  EXECUTE FUNCTION spawn_next_recurring_marketing_task();
