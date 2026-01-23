/*
  # Ensure Periodic Automation Robust Daily Execution
  
  1. Requirements
    - Cron job runs daily at 9:00 AM HKT
    - Check if project is at Action Frequency (N days) from the specified date field
    - Check all matching projects (by status/substatus)
    - Execute on action days, regardless of previous records (for new or existing projects)
    - Prevent duplicate executions on the same day
  
  2. Logic
    - Calculate: days_since_start = TODAY - project[date_field]
    - If days_since_start >= frequency AND days_since_start % frequency == 0:
      - This is an ACTION DAY
      - Execute the action (add label, add task, change status)
      - Track execution to prevent duplicates on the same day
  
  3. Key Points
    - Validates date field exists before querying
    - Handles null date values gracefully
    - Executes for both new projects (no record) and existing projects (has record)
    - Only prevents duplicate execution on the SAME DAY
*/

CREATE OR REPLACE FUNCTION public.execute_periodic_automations()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  rule_record RECORD;
  project_record RECORD;
  execution_record RECORD;
  today_date date := CURRENT_DATE;
  interval_days int;
  date_field text;
  reference_date date;
  days_since_start int;
  is_action_day boolean;
  already_executed_today boolean;
  total_executed int := 0;
  total_skipped int := 0;
  result_json json;
  dynamic_query text;
  field_exists boolean;
BEGIN
  RAISE NOTICE '=== Starting periodic automation check at % ===', NOW();
  
  -- Loop through all active periodic automation rules
  FOR rule_record IN 
    SELECT * FROM automation_rules 
    WHERE trigger_type = 'periodic' AND is_active = true
    ORDER BY name
  LOOP
    BEGIN
      -- Get configuration
      interval_days := COALESCE((rule_record.trigger_config->>'frequency')::int, 1);
      date_field := COALESCE(rule_record.trigger_config->>'date_field', 'start_date');
      
      RAISE NOTICE 'Processing rule: % (frequency: % days, date_field: %)', 
        rule_record.name, interval_days, date_field;
      
      -- Validate date field exists
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'projects' 
          AND column_name = date_field
      ) INTO field_exists;
      
      IF NOT field_exists THEN
        RAISE NOTICE '  ⚠ SKIPPED: Date field "%" does not exist in projects table', date_field;
        total_skipped := total_skipped + 1;
        CONTINUE;
      END IF;
      
      -- Build dynamic query to get all matching projects
      dynamic_query := format(
        'SELECT p.id, p.title, p.%I as reference_date, p.sales_person_id,
        s.name as status_name, s.parent_status_id
        FROM projects p
        JOIN statuses s ON s.id = p.status_id
        WHERE p.project_type_id = $1
        AND p.%I IS NOT NULL
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
        date_field,
        date_field
      );
      
      -- Process all matching projects
      FOR project_record IN
        EXECUTE dynamic_query
        USING rule_record.project_type_id, rule_record.substatus_filter, rule_record.main_status
      LOOP
        reference_date := project_record.reference_date::date;
        
        IF reference_date IS NULL THEN
          CONTINUE;
        END IF;
        
        -- Calculate days since the reference date
        days_since_start := today_date - reference_date;
        
        -- Determine if today is an action day
        -- Action days: N, 2N, 3N, 4N... days from reference date
        is_action_day := (days_since_start >= interval_days) AND 
                         ((days_since_start % interval_days) = 0);
        
        IF NOT is_action_day THEN
          CONTINUE;
        END IF;
        
        -- TODAY IS AN ACTION DAY!
        RAISE NOTICE '  ✓ Action day for project: % (days since %: %)', 
          project_record.title, date_field, days_since_start;
        
        -- Check if we already executed TODAY (to prevent duplicate executions)
        SELECT 
          last_executed_at::date = today_date
        INTO already_executed_today
        FROM periodic_automation_executions
        WHERE automation_rule_id = rule_record.id
          AND project_id = project_record.id;
        
        IF already_executed_today THEN
          RAISE NOTICE '    ⊘ Already executed today, skipping';
          CONTINUE;
        END IF;
        
        -- EXECUTE THE ACTION
        IF rule_record.action_type = 'add_label' THEN
          -- Add label if not exists
          INSERT INTO project_labels (project_id, label_id)
          SELECT project_record.id, (rule_record.action_config->>'label_id')::uuid
          WHERE NOT EXISTS (
            SELECT 1 FROM project_labels
            WHERE project_id = project_record.id
              AND label_id = (rule_record.action_config->>'label_id')::uuid
          );
          
          RAISE NOTICE '    → Label added';
          
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
              WHEN rule_record.action_config->>'assigned_to' = '__project_sales_person__' THEN 
                project_record.sales_person_id
              ELSE 
                (rule_record.action_config->>'assigned_to')::uuid
            END,
            false
          );
          
          RAISE NOTICE '    → Task added: %', rule_record.action_config->>'title';
          
        ELSIF rule_record.action_type = 'change_status' THEN
          -- Change status
          UPDATE projects
          SET status_id = (rule_record.action_config->>'status_id')::uuid,
              updated_at = NOW()
          WHERE id = project_record.id;
          
          RAISE NOTICE '    → Status changed';
        END IF;
        
        -- Track execution (upsert)
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
        )
        ON CONFLICT (automation_rule_id, project_id) 
        DO UPDATE SET
          last_executed_at = NOW(),
          next_execution_at = (today_date + interval_days)::timestamptz,
          updated_at = NOW();
        
        total_executed := total_executed + 1;
      END LOOP;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '  ✗ ERROR processing rule %: %', rule_record.name, SQLERRM;
        total_skipped := total_skipped + 1;
        CONTINUE;
    END;
  END LOOP;
  
  RAISE NOTICE '=== Periodic automation complete: % executed, % skipped ===', 
    total_executed, total_skipped;
  
  result_json := json_build_object(
    'success', true,
    'executed', total_executed,
    'skipped', total_skipped,
    'timestamp', NOW()
  );
  
  RETURN result_json;
END;
$function$;

-- Ensure unique constraint exists for tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'periodic_automation_executions_rule_project_key'
  ) THEN
    ALTER TABLE periodic_automation_executions 
    ADD CONSTRAINT periodic_automation_executions_rule_project_key 
    UNIQUE (automation_rule_id, project_id);
  END IF;
END $$;
