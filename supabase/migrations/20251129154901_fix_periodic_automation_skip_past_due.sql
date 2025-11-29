/*
  # Fix Periodic Automation to Skip Past Due First Executions
  
  Updates the execute_periodic_automations function to:
  - If the first execution date is in the past, skip it and schedule for the next future occurrence
  - Only execute on future scheduled dates
  
  Example with frequency = 5 days:
  - Project start: Nov 20, 2025
  - First execution due: Nov 25, 2025 (project_start + 5 days)
  - Today is Nov 29, 2025
  - Should NOT execute today
  - Should schedule for next future date: Dec 1, 2025 (Nov 20 + 10 days)
  - Then execute on Dec 1, Dec 6, Dec 11, etc.
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
  now_timestamp timestamptz := NOW();
  interval_days int;
  date_field text;
  project_start_date timestamptz;
  first_execution_date timestamptz;
  next_execution_date timestamptz;
  should_execute boolean;
  total_executed int := 0;
  result_json json;
  cycles_to_skip int;
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
      project_start_date := project_record.project_start_date;
      
      IF project_start_date IS NULL THEN
        CONTINUE;
      END IF;
      
      -- Check if execution record exists
      SELECT * INTO execution_record
      FROM periodic_automation_executions
      WHERE automation_rule_id = rule_record.id
        AND project_id = project_record.id;
      
      should_execute := false;
      
      IF execution_record IS NULL THEN
        -- Calculate first execution date: project_start_date + frequency days
        first_execution_date := project_start_date + (interval_days || ' days')::interval;
        
        -- If first execution is in the past, calculate next future execution
        IF first_execution_date < now_timestamp THEN
          -- Calculate how many cycles to skip to get to next future date
          cycles_to_skip := CEIL(EXTRACT(EPOCH FROM (now_timestamp - first_execution_date)) / (interval_days * 86400));
          
          -- Calculate next future execution date
          next_execution_date := first_execution_date + (cycles_to_skip * interval_days || ' days')::interval;
          
          -- Insert execution record WITHOUT executing (skip past due)
          INSERT INTO periodic_automation_executions (
            automation_rule_id,
            project_id,
            last_executed_at,
            next_execution_at
          ) VALUES (
            rule_record.id,
            project_record.id,
            NULL,  -- Never executed yet
            next_execution_date
          );
          
          -- Do NOT execute
          should_execute := false;
          
        ELSE
          -- First execution is in the future or today, wait for it
          -- Do NOT execute yet
          should_execute := false;
        END IF;
        
      ELSIF execution_record.next_execution_at <= now_timestamp THEN
        -- Scheduled execution time has arrived, execute it
        should_execute := true;
        
        -- Calculate next execution from the SCHEDULED time
        next_execution_date := execution_record.next_execution_at + (interval_days || ' days')::interval;
        
        -- Update execution record
        UPDATE periodic_automation_executions
        SET last_executed_at = now_timestamp,
            next_execution_at = next_execution_date,
            updated_at = now_timestamp
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
                now_timestamp + ((rule_record.action_config->>'due_date_offset')::int || ' days')::interval
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
    'timestamp', now_timestamp
  );
  
  RETURN result_json;
END;
$$;
