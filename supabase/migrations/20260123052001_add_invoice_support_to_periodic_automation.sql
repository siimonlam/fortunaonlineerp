/*
  # Add Invoice Support to Periodic Automation
  
  1. Purpose
    - Enable periodic automation rules to check invoices (not just projects)
    - Support invoice chase rules that execute every N days from invoice issue_date
  
  2. Logic
    - If rule has `check_invoices: true` in trigger_config:
      - Query funding_invoice table instead of projects table
      - Use issue_date as the reference date
      - Only check unpaid invoices (payment_status != 'Paid')
      - Create tasks linked to the invoice's project
  
  3. Invoice Chase Rule
    - Check every 9 days from issue_date
    - Only for unpaid invoices
    - Create task: "Chase Invoice on Whatsapp or Email"
*/

-- Create tracking table for invoice automations if not exists
CREATE TABLE IF NOT EXISTS periodic_invoice_automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES funding_invoice(id) ON DELETE CASCADE,
  last_executed_at timestamptz NOT NULL DEFAULT NOW(),
  next_execution_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE (automation_rule_id, invoice_id)
);

-- Enable RLS
ALTER TABLE periodic_invoice_automation_executions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all authenticated users to view invoice executions"
  ON periodic_invoice_automation_executions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role to manage invoice executions"
  ON periodic_invoice_automation_executions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update the periodic automation function to support invoices
CREATE OR REPLACE FUNCTION public.execute_periodic_automations()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  rule_record RECORD;
  project_record RECORD;
  invoice_record RECORD;
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
  check_invoices boolean;
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
        
        -- Process all unpaid invoices
        FOR invoice_record IN
          SELECT 
            fi.id,
            fi.invoice_number,
            fi.project_id,
            fi.issue_date,
            fi.amount,
            fi.payment_status,
            p.sales_person_id,
            p.title as project_title
          FROM funding_invoice fi
          JOIN projects p ON p.id = fi.project_id
          WHERE fi.payment_status != 'Paid'
            AND fi.issue_date IS NOT NULL
            AND fi.project_id = p.id
        LOOP
          reference_date := invoice_record.issue_date::date;
          
          IF reference_date IS NULL THEN
            CONTINUE;
          END IF;
          
          -- Calculate days since invoice issue date
          days_since_start := today_date - reference_date;
          
          -- Determine if today is an action day
          is_action_day := (days_since_start >= interval_days) AND 
                           ((days_since_start % interval_days) = 0);
          
          IF NOT is_action_day THEN
            CONTINUE;
          END IF;
          
          -- TODAY IS AN ACTION DAY for this invoice!
          RAISE NOTICE '  ✓ Invoice chase day: % (days since issue: %)', 
            invoice_record.invoice_number, days_since_start;
          
          -- Check if we already executed TODAY
          SELECT 
            last_executed_at::date = today_date
          INTO already_executed_today
          FROM periodic_invoice_automation_executions
          WHERE automation_rule_id = rule_record.id
            AND invoice_id = invoice_record.id;
          
          IF already_executed_today THEN
            RAISE NOTICE '    ⊘ Already executed today, skipping';
            CONTINUE;
          END IF;
          
          -- EXECUTE THE ACTION (add task)
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
              format('Chase invoice %s (Amount: $%s, Days overdue: %s)',
                invoice_record.invoice_number,
                invoice_record.amount,
                days_since_start
              ),
              CASE 
                WHEN rule_record.action_config->>'due_date_base' = 'current_day' THEN
                  NOW() + ((rule_record.action_config->>'due_date_offset')::int || ' days')::interval
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
            
            RAISE NOTICE '    → Task added for invoice %', invoice_record.invoice_number;
          END IF;
          
          -- Track execution
          INSERT INTO periodic_invoice_automation_executions (
            automation_rule_id,
            invoice_id,
            last_executed_at,
            next_execution_at
          ) VALUES (
            rule_record.id,
            invoice_record.id,
            NOW(),
            (today_date + interval_days)::timestamptz
          )
          ON CONFLICT (automation_rule_id, invoice_id) 
          DO UPDATE SET
            last_executed_at = NOW(),
            next_execution_at = (today_date + interval_days)::timestamptz,
            updated_at = NOW();
          
          total_executed := total_executed + 1;
        END LOOP;
        
        CONTINUE; -- Skip project checking for invoice rules
      END IF;
      
      -- ========== PROJECT CHECKING MODE (original logic) ==========
      
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
        is_action_day := (days_since_start >= interval_days) AND 
                         ((days_since_start % interval_days) = 0);
        
        IF NOT is_action_day THEN
          CONTINUE;
        END IF;
        
        -- TODAY IS AN ACTION DAY!
        RAISE NOTICE '  ✓ Action day for project: % (days since %: %)', 
          project_record.title, date_field, days_since_start;
        
        -- Check if we already executed TODAY
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

-- Enable realtime for tracking
ALTER PUBLICATION supabase_realtime ADD TABLE periodic_invoice_automation_executions;
