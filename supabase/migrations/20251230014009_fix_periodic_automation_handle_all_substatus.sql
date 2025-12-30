/*
  # Fix Periodic Automation to Handle "All" substatus_filter

  1. Changes
    - Update `execute_periodic_automations()` function to treat "All" as "no substatus filter"
    - When substatus_filter is "All" or NULL, use main_status logic
    - Otherwise, match exact status_id
    
  2. Bug Fixed
    - Previously, substatus_filter = "All" was treated as a UUID to match
    - This caused the query to find 0 projects since no status_id equals "All"
    - Now "All" means "match all substatuses under main_status"
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
    date_field := COALESCE(rule_record.trigger_config->>'date_field', 'start_date');
    
    -- Get all projects matching the rule criteria
    FOR project_record IN
      SELECT p.id, p.title, p.start_date, p.deposit_paid_date, p.sales_person_id,
             s.name as status_name, s.parent_status_id
      FROM projects p
      JOIN statuses s ON s.id = p.status_id
      WHERE p.project_type_id = rule_record.project_type_id
        AND (
          -- If substatus_filter is NULL or "All", use main_status logic
          ((rule_record.substatus_filter IS NULL OR rule_record.substatus_filter = 'All') AND (
            s.name = rule_record.main_status 
            OR EXISTS (
              SELECT 1 FROM statuses parent 
              WHERE parent.id = s.parent_status_id 
              AND parent.name = rule_record.main_status
            )
          ))
          OR
          -- Otherwise match exact status_id
          (rule_record.substatus_filter IS NOT NULL AND rule_record.substatus_filter != 'All' AND p.status_id::text = rule_record.substatus_filter)
        )
    LOOP
      -- Get project start date based on date_field
      IF date_field = 'deposit_paid_date' THEN
        project_start_date := project_record.deposit_paid_date::date;
      ELSIF date_field = 'start_date' THEN
        project_start_date := project_record.start_date::date;
      ELSE
        -- Default to start_date for unknown date fields
        project_start_date := project_record.start_date::date;
      END IF;
      
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
