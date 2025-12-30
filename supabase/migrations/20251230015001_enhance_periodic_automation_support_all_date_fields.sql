/*
  # Enhance Periodic Automation to Support All Date Fields

  1. Changes
    - Update `execute_periodic_automations()` function to dynamically support any date field
    - Instead of hard-coding IF/ELSIF for each field, use dynamic SQL to read any date column
    - This makes the system fully flexible when users change the date_field configuration
    
  2. Supported Date Fields
    - start_date
    - project_start_date
    - project_end_date
    - submission_date
    - approval_date
    - deposit_paid_date
    - hi_po_date
    - next_due_date
    - And any future date fields added to the projects table
    
  3. Benefits
    - Users can change automation rules to use any date field without backend changes
    - The function dynamically adapts to the configuration
    - Fully flexible and future-proof
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
  dynamic_query text;
BEGIN
  -- Loop through all active periodic automation rules
  FOR rule_record IN 
    SELECT * FROM automation_rules 
    WHERE trigger_type = 'periodic' AND is_active = true
  LOOP
    -- Get interval days from rule config
    interval_days := COALESCE((rule_record.trigger_config->>'frequency')::int, 1);
    date_field := COALESCE(rule_record.trigger_config->>'date_field', 'start_date');
    
    -- Build dynamic query to get all matching projects with the specified date field
    dynamic_query := format(
      'SELECT p.id, p.title, p.%I as reference_date, p.start_date, p.deposit_paid_date, p.sales_person_id,
              s.name as status_name, s.parent_status_id
       FROM projects p
       JOIN statuses s ON s.id = p.status_id
       WHERE p.project_type_id = $1
         AND (
           (($2 IS NULL OR $2 = ''All'') AND (
             s.name = $3
             OR EXISTS (
               SELECT 1 FROM statuses parent 
               WHERE parent.id = s.parent_status_id 
               AND parent.name = $3
             )
           ))
           OR
           ($2 IS NOT NULL AND $2 != ''All'' AND p.status_id::text = $2)
         )',
      date_field  -- %I safely quotes the identifier
    );
    
    -- Get all projects matching the rule criteria
    FOR project_record IN
      EXECUTE dynamic_query
      USING rule_record.project_type_id, rule_record.substatus_filter, rule_record.main_status
    LOOP
      -- Get the reference date from the dynamically selected field
      project_start_date := project_record.reference_date::date;
      
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
      -- Action days are: reference_date + interval_days, reference_date + (2 * interval_days), etc.
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
          
        ELSIF rule_record.action_type = 'change_status' THEN
          -- Change status
          UPDATE projects
          SET status_id = (rule_record.action_config->>'status_id')::uuid,
              updated_at = NOW()
          WHERE id = project_record.id;
          
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
