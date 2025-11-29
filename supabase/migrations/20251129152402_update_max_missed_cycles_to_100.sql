/*
  # Update Max Missed Cycles to 100
  
  Updates the execute_periodic_automations function to allow up to 100 missed cycles:
  - Increases max_missed_cycles from 5 to 100
  - This allows automation to execute on older projects
  - Useful for catching up on projects that have been in a status for a long time
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
  missed_cycles int;
  max_missed_cycles int := 100; -- Increased from 5 to 100
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
        
        -- Calculate how many cycles we missed
        missed_cycles := FLOOR(EXTRACT(EPOCH FROM (now_timestamp - first_execution_date)) / (interval_days * 86400));
        
        -- Only execute if:
        -- 1. First execution date has arrived
        -- 2. We haven't missed too many cycles (project isn't too old)
        IF first_execution_date <= now_timestamp AND missed_cycles <= max_missed_cycles THEN
          should_execute := true;
          
          -- Calculate next execution: first_execution + (missed_cycles + 1) * frequency days
          -- This keeps us on the regular schedule
          next_execution_date := first_execution_date + ((missed_cycles + 1) * interval_days || ' days')::interval;
          
          -- Insert execution record
          INSERT INTO periodic_automation_executions (
            automation_rule_id,
            project_id,
            last_executed_at,
            next_execution_at
          ) VALUES (
            rule_record.id,
            project_record.id,
            now_timestamp,
            next_execution_date
          );
        ELSIF first_execution_date <= now_timestamp THEN
          -- Project is too old, but create execution record with next future date
          -- Skip execution but set up for future runs
          next_execution_date := now_timestamp + (interval_days || ' days')::interval;
          
          INSERT INTO periodic_automation_executions (
            automation_rule_id,
            project_id,
            last_executed_at,
            next_execution_at
          ) VALUES (
            rule_record.id,
            project_record.id,
            now_timestamp,
            next_execution_date
          );
        END IF;
      ELSIF execution_record.next_execution_at <= now_timestamp THEN
        -- Calculate how many cycles we missed since the last scheduled execution
        missed_cycles := FLOOR(EXTRACT(EPOCH FROM (now_timestamp - execution_record.next_execution_at)) / (interval_days * 86400));
        
        -- Only execute if we haven't missed too many cycles
        IF missed_cycles <= max_missed_cycles THEN
          should_execute := true;
          
          -- Calculate next execution from the SCHEDULED time, not from NOW
          next_execution_date := execution_record.next_execution_at + ((missed_cycles + 1) * interval_days || ' days')::interval;
        ELSE
          -- Too many missed cycles, just schedule for next period
          should_execute := false;
          next_execution_date := now_timestamp + (interval_days || ' days')::interval;
        END IF;
        
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
