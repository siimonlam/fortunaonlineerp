/*
  # Update Periodic Automation to Check Execution Frequency

  1. Changes
    - Update `check_and_execute_periodic_automations` function to respect `execution_frequency_days`
    - Only execute automations where the last execution was N days ago (based on execution_frequency_days)
    - Improves performance by not checking automations that shouldn't run yet

  2. Logic
    - If execution_frequency_days = 1: run daily (default behavior)
    - If execution_frequency_days = 7: run weekly (every 7 days)
    - If execution_frequency_days = 30: run monthly (every 30 days)
*/

CREATE OR REPLACE FUNCTION check_and_execute_periodic_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rule_record RECORD;
  project_record RECORD;
  action_frequency integer;
  days_since_start integer;
  should_trigger boolean;
  project_start_date date;
  days_since_last_execution integer;
BEGIN
  -- Loop through all enabled periodic automation rules
  FOR rule_record IN
    SELECT ar.*, apt.last_executed_at
    FROM automation_rules ar
    LEFT JOIN automation_periodic_tracking apt ON ar.id = apt.rule_id
    WHERE ar.enabled = true
      AND ar.trigger_type = 'periodic'
  LOOP
    -- Check if this automation should run today based on execution_frequency_days
    days_since_last_execution := CASE
      WHEN rule_record.last_executed_at IS NULL THEN 999999 -- Never executed
      ELSE EXTRACT(DAY FROM (CURRENT_DATE - rule_record.last_executed_at::date))::integer
    END;

    -- Skip if not enough days have passed since last execution
    IF days_since_last_execution < rule_record.execution_frequency_days THEN
      CONTINUE;
    END IF;

    -- Extract action frequency from conditions
    action_frequency := (rule_record.conditions->>'frequency')::integer;
    
    IF action_frequency IS NULL OR action_frequency < 1 THEN
      CONTINUE;
    END IF;

    -- Find matching projects based on rule conditions
    FOR project_record IN
      SELECT p.*
      FROM projects p
      WHERE p.project_type = rule_record.project_type
        AND (rule_record.conditions->>'status' IS NULL OR p.status = rule_record.conditions->>'status')
    LOOP
      -- Determine start date based on date_field in conditions
      project_start_date := CASE
        WHEN rule_record.conditions->>'date_field' = 'created_at' THEN project_record.created_at::date
        WHEN rule_record.conditions->>'date_field' = 'submission_date' THEN project_record.submission_date
        WHEN rule_record.conditions->>'date_field' = 'approval_date' THEN project_record.approval_date
        WHEN rule_record.conditions->>'date_field' = 'hkpc_date' THEN project_record.hkpc_date
        ELSE project_record.created_at::date
      END;

      IF project_start_date IS NULL THEN
        CONTINUE;
      END IF;

      days_since_start := EXTRACT(DAY FROM (CURRENT_DATE - project_start_date))::integer;

      -- Check if today matches the periodic frequency (day 30, 60, 90, etc.)
      should_trigger := (days_since_start > 0 AND days_since_start % action_frequency = 0);

      -- Execute action if triggered
      IF should_trigger THEN
        CASE rule_record.action_type
          WHEN 'add_task' THEN
            INSERT INTO tasks (project_id, title, description, status, created_at)
            VALUES (
              project_record.id,
              rule_record.action_config->>'task_title',
              rule_record.action_config->>'task_description',
              'pending',
              NOW()
            )
            ON CONFLICT DO NOTHING;

          WHEN 'add_label' THEN
            INSERT INTO project_labels (project_id, label_id)
            VALUES (
              project_record.id,
              (rule_record.action_config->>'label_id')::uuid
            )
            ON CONFLICT DO NOTHING;

          WHEN 'remove_label' THEN
            DELETE FROM project_labels
            WHERE project_id = project_record.id
              AND label_id = (rule_record.action_config->>'label_id')::uuid;

          WHEN 'change_status' THEN
            UPDATE projects
            SET status = rule_record.action_config->>'new_status',
                updated_at = NOW()
            WHERE id = project_record.id;

          WHEN 'set_field_value' THEN
            -- Dynamic field update based on action_config
            EXECUTE format('UPDATE projects SET %I = $1, updated_at = NOW() WHERE id = $2',
              rule_record.action_config->>'field_name')
            USING rule_record.action_config->>'field_value', project_record.id;
        END CASE;
      END IF;
    END LOOP;

    -- Update last_executed_at for this rule
    INSERT INTO automation_periodic_tracking (rule_id, last_executed_at)
    VALUES (rule_record.id, NOW())
    ON CONFLICT (rule_id)
    DO UPDATE SET last_executed_at = NOW();
  END LOOP;
END;
$$;