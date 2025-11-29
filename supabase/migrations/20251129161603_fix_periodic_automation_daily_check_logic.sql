/*
  # Fix Periodic Automation - Daily Check Logic
  
  The automation should run daily and check if TODAY is the exact day to execute.
  
  Logic:
  - Project A: Start Oct 1, Frequency 10 days
    - Execute on: Oct 11, Oct 21, Oct 31, Nov 10, etc.
  - Project B: Start Oct 2, Frequency 10 days  
    - Execute on: Oct 12, Oct 22, Nov 1, Nov 11, etc.
    
  Rules:
  1. Run daily and check all projects
  2. Calculate if TODAY is an "action day" (start_date + N × frequency, where N = 1, 2, 3...)
  3. Only execute if TODAY matches exactly
  4. If action day is past, skip it (no catch-up)
  5. Track last action to avoid duplicate execution on same day
*/

DROP FUNCTION IF EXISTS execute_periodic_automations();

CREATE FUNCTION execute_periodic_automations()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rule_record RECORD;
  project_record RECORD;
  execution_record RECORD;
  today_date date := CURRENT_DATE;
  interval_days int;
  date_field text;
  project_start_date date;
  days_since_start int;
  should_execute boolean;
  total_executed int := 0;
  result_json json;
BEGIN
  -- Loop through all active periodic automation rules
  FOR rule_record IN 
    SELECT * FROM automation_rules 
    WHERE trigger_type = 'periodic' AND is_active = true
  LOOP
    -- Get interval days from rule config
    interval_days := COALESCE((rule_record.trigger_config->>'frequency')::int, 1);
    date_field := COALESCE(rule_record.trigger_config->>'date_field', 'project_start_date');
    
    -- Get all projects in the target status
    FOR project_record IN
      SELECT p.id, p.title, p.project_start_date, p.sales_person_id,
             s.name as status_name, s.parent_status_id
      FROM projects p
      JOIN statuses s ON s.id = p.status_id
      WHERE p.project_type_id = rule_record.project_type_id
        AND (s.name = rule_record.main_status 
             OR EXISTS (
               SELECT 1 FROM statuses parent 
               WHERE parent.id = s.parent_status_id 
               AND parent.name = rule_record.main_status
             ))
    LOOP
      -- Get project start date
      project_start_date := project_record.project_start_date::date;
      
      IF project_start_date IS NULL THEN
        CONTINUE;
      END IF;
      
      -- Calculate days since project start
      days_since_start := today_date - project_start_date;
      
      -- Skip if we haven't reached the first execution day yet
      IF days_since_start < interval_days THEN
        CONTINUE;
      END IF;
      
      -- Check if TODAY is an action day
      -- Action days are: start_date + interval_days, start_date + (2 * interval_days), etc.
      -- This means days_since_start should be divisible by interval_days
      IF (days_since_start % interval_days) != 0 THEN
        CONTINUE;  -- Not an action day
      END IF;
      
      -- TODAY is an action day! Check if we already executed today
      SELECT * INTO execution_record
      FROM periodic_automation_executions
      WHERE automation_rule_id = rule_record.id
        AND project_id = project_record.id;
      
      should_execute := false;
      
      IF execution_record IS NULL THEN
        -- First time seeing this project, execute
        should_execute := true;
        
        -- Insert execution record
        INSERT INTO periodic_automation_executions (
          automation_rule_id,
          project_id,
          last_executed_at,
          next_execution_at
        ) VALUES (
          rule_record.id,
          project_record.id,
          NOW(),
          (today_date + interval_days)::timestamptz
        );
        
      ELSIF execution_record.last_executed_at::date < today_date THEN
        -- We haven't executed today yet, execute
        should_execute := true;
        
        -- Update execution record
        UPDATE periodic_automation_executions
        SET last_executed_at = NOW(),
            next_execution_at = (today_date + interval_days)::timestamptz,
            updated_at = NOW()
        WHERE id = execution_record.id;
      END IF;
      
      -- Execute the automation action
      IF should_execute THEN
        IF rule_record.action_type = 'add_label' THEN
          -- Add label if not exists
          INSERT INTO project_labels (project_id, label_id)
          SELECT project_record.id, (rule_record.action_config->>'label_id')::uuid
          WHERE NOT EXISTS (
            SELECT 1 FROM project_labels
            WHERE project_id = project_record.id
              AND label_id = (rule_record.action_config->>'label_id')::uuid
          );
          
          total_executed := total_executed + 1;
          
        ELSIF rule_record.action_type = 'add_task' THEN
          -- Add task
          INSERT INTO tasks (
            project_id,
            title,
            description,
            deadline,
            assigned_to,
            completed
          ) VALUES (
            project_record.id,
            rule_record.action_config->>'title',
            COALESCE(rule_record.action_config->>'description', ''),
            CASE 
              WHEN rule_record.action_config->>'due_date_base' = 'current_day' THEN
                NOW() + ((rule_record.action_config->>'due_date_offset')::int || ' days')::interval
              ELSE NULL
            END,
            CASE 
              WHEN rule_record.action_config->>'assigned_to' = '__project_sales_person__' THEN project_record.sales_person_id
              ELSE (rule_record.action_config->>'assigned_to')::uuid
            END,
            false
          );
          
          total_executed := total_executed + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  result_json := json_build_object(
    'success', true,
    'executed', total_executed,
    'timestamp', NOW()
  );
  
  RETURN result_json;
END;
$$;
