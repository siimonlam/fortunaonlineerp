/*
  # Fix Periodic Automation Function - Restore Database Logic
  
  1. Problem
    - Current function returns void and tries to call edge function
    - Edge function requires authorization that is not available
    - This causes all periodic automations to fail silently
  
  2. Solution
    - Replace function with version that processes everything in the database
    - No external HTTP calls needed
    - Returns JSON with execution results
  
  3. Features
    - Processes both project-based and invoice-based automations
    - Validates date fields exist before querying
    - Prevents duplicate executions on the same day
    - Supports all action types: add_task, add_label, change_status
*/

-- Drop and recreate the function with database logic
DROP FUNCTION IF EXISTS public.execute_periodic_automations();

CREATE OR REPLACE FUNCTION public.execute_periodic_automations()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  rule_record RECORD;
  project_record RECORD;
  invoice_record RECORD;
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
  check_invoices boolean;
  status_ids uuid[];
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
      check_invoices := COALESCE((rule_record.trigger_config->>'check_invoices')::boolean, false);
      
      RAISE NOTICE 'Processing rule: % (frequency: % days, date_field: %, check_invoices: %)', 
        rule_record.name, interval_days, date_field, check_invoices;
      
      -- ========== INVOICE CHECKING MODE ==========
      IF check_invoices THEN
        RAISE NOTICE '  → Checking invoices...';
        
        -- Get status IDs if filtering by status
        status_ids := ARRAY[]::uuid[];
        IF rule_record.project_type_id IS NOT NULL AND rule_record.main_status != 'All' THEN
          IF rule_record.substatus_filter IS NOT NULL AND rule_record.substatus_filter != 'All' THEN
            status_ids := ARRAY[rule_record.substatus_filter::uuid];
          ELSE
            SELECT ARRAY_AGG(DISTINCT s.id)
            INTO status_ids
            FROM statuses s
            LEFT JOIN statuses parent ON s.parent_status_id = parent.id
            WHERE s.project_type_id = rule_record.project_type_id
              AND (s.name = rule_record.main_status OR parent.name = rule_record.main_status);
          END IF;
        END IF;
        
        -- Process invoices
        FOR invoice_record IN
          SELECT 
            fi.id as invoice_id,
            fi.invoice_number,
            fi.project_id,
            fi.issue_date,
            p.sales_person_id
          FROM funding_invoice fi
          JOIN projects p ON p.id = fi.project_id
          WHERE fi.issue_date IS NOT NULL
            AND fi.payment_status IN ('unpaid', 'Pending', 'pending', 'Overdue')
            AND (rule_record.project_type_id IS NULL OR p.project_type_id = rule_record.project_type_id)
            AND (array_length(status_ids, 1) IS NULL OR p.status_id = ANY(status_ids))
        LOOP
          reference_date := invoice_record.issue_date::date;
          days_since_start := today_date - reference_date;
          
          -- Check if today is an action day
          is_action_day := (days_since_start > 0) AND ((days_since_start % interval_days) = 0);
          
          IF NOT is_action_day THEN
            CONTINUE;
          END IF;
          
          -- Check if already executed today
          SELECT (last_executed_at::date = today_date)
          INTO already_executed_today
          FROM periodic_automation_executions
          WHERE automation_rule_id = rule_record.id
            AND project_id = invoice_record.project_id
            AND invoice_id = invoice_record.invoice_id;
          
          IF already_executed_today THEN
            RAISE NOTICE '    ⊘ Already executed today for invoice %', invoice_record.invoice_number;
            CONTINUE;
          END IF;
          
          RAISE NOTICE '  ✓ Action day for invoice: % (days since issue: %)', 
            invoice_record.invoice_number, days_since_start;
          
          -- Execute action
          IF rule_record.action_type = 'add_task' THEN
            INSERT INTO tasks (
              project_id,
              title,
              description,
              deadline,
              assigned_to,
              completed
            ) VALUES (
              invoice_record.project_id,
              rule_record.action_config->>'title',
              COALESCE(rule_record.action_config->>'description', ''),
              CASE 
                WHEN rule_record.action_config->>'due_date_base' = 'current_day' THEN
                  NOW() + ((COALESCE(rule_record.action_config->>'due_date_offset', '0')::int) || ' days')::interval
                ELSE NULL
              END,
              CASE 
                WHEN rule_record.action_config->>'assigned_to' = '__project_sales_person__' THEN 
                  invoice_record.sales_person_id
                ELSE 
                  (rule_record.action_config->>'assigned_to')::uuid
              END,
              false
            );
            RAISE NOTICE '    → Task added';
          END IF;
          
          -- Track execution
          INSERT INTO periodic_automation_executions (
            automation_rule_id,
            project_id,
            invoice_id,
            last_executed_at,
            next_execution_at
          ) VALUES (
            rule_record.id,
            invoice_record.project_id,
            invoice_record.invoice_id,
            NOW(),
            (today_date + interval_days)::timestamptz
          )
          ON CONFLICT (automation_rule_id, project_id) 
          DO UPDATE SET
            invoice_id = invoice_record.invoice_id,
            last_executed_at = NOW(),
            next_execution_at = (today_date + interval_days)::timestamptz,
            updated_at = NOW();
          
          total_executed := total_executed + 1;
        END LOOP;
        
      -- ========== PROJECT CHECKING MODE ==========
      ELSE
        RAISE NOTICE '  → Checking projects...';
        
        -- Validate date field exists
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_schema = 'public'
            AND table_name = 'projects' 
            AND column_name = date_field
        ) INTO field_exists;
        
        IF NOT field_exists THEN
          RAISE NOTICE '  ⚠ SKIPPED: Date field "%" does not exist', date_field;
          total_skipped := total_skipped + 1;
          CONTINUE;
        END IF;
        
        -- Get status IDs
        status_ids := ARRAY[]::uuid[];
        IF rule_record.main_status = 'All' THEN
          SELECT ARRAY_AGG(id)
          INTO status_ids
          FROM statuses
          WHERE project_type_id = rule_record.project_type_id;
        ELSIF rule_record.substatus_filter IS NOT NULL AND rule_record.substatus_filter != 'All' THEN
          status_ids := ARRAY[rule_record.substatus_filter::uuid];
        ELSE
          SELECT ARRAY_AGG(DISTINCT s.id)
          INTO status_ids
          FROM statuses s
          LEFT JOIN statuses parent ON s.parent_status_id = parent.id
          WHERE s.project_type_id = rule_record.project_type_id
            AND (s.name = rule_record.main_status OR parent.name = rule_record.main_status);
        END IF;
        
        -- Build and execute dynamic query
        dynamic_query := format(
          'SELECT p.id, p.title, p.%I as reference_date, p.sales_person_id
          FROM projects p
          WHERE p.project_type_id = $1
          AND p.%I IS NOT NULL
          AND p.status_id = ANY($2)',
          date_field, date_field
        );
        
        -- Process projects
        FOR project_record IN
          EXECUTE dynamic_query
          USING rule_record.project_type_id, status_ids
        LOOP
          reference_date := project_record.reference_date::date;
          days_since_start := today_date - reference_date;
          
          -- Check if today is an action day
          is_action_day := (days_since_start >= interval_days) AND 
                           ((days_since_start % interval_days) = 0);
          
          IF NOT is_action_day THEN
            CONTINUE;
          END IF;
          
          -- Check if already executed today
          SELECT (last_executed_at::date = today_date)
          INTO already_executed_today
          FROM periodic_automation_executions
          WHERE automation_rule_id = rule_record.id
            AND project_id = project_record.id;
          
          IF already_executed_today THEN
            RAISE NOTICE '    ⊘ Already executed today for %', project_record.title;
            CONTINUE;
          END IF;
          
          RAISE NOTICE '  ✓ Action day for project: % (days since %: %)', 
            project_record.title, date_field, days_since_start;
          
          -- Execute action
          IF rule_record.action_type = 'add_label' THEN
            INSERT INTO project_labels (project_id, label_id)
            SELECT project_record.id, (rule_record.action_config->>'label_id')::uuid
            WHERE NOT EXISTS (
              SELECT 1 FROM project_labels
              WHERE project_id = project_record.id
                AND label_id = (rule_record.action_config->>'label_id')::uuid
            );
            RAISE NOTICE '    → Label added';
            
          ELSIF rule_record.action_type = 'add_task' THEN
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
                  NOW() + ((COALESCE(rule_record.action_config->>'due_date_offset', '0')::int) || ' days')::interval
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
            RAISE NOTICE '    → Task added';
            
          ELSIF rule_record.action_type = 'change_status' THEN
            UPDATE projects
            SET status_id = (rule_record.action_config->>'status_id')::uuid,
                updated_at = NOW()
            WHERE id = project_record.id;
            RAISE NOTICE '    → Status changed';
          END IF;
          
          -- Track execution
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
      END IF;
      
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
