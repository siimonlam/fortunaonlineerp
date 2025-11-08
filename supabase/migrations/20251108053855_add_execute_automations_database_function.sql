/*
  # Add Database Function to Execute Automations
  
  1. New Functions
    - `execute_project_automations` - Standalone function to execute automations for a project
    - Can be called from frontend as backup or directly
  
  2. How it works
    - Takes project_id and trigger_type as parameters
    - Finds and executes matching automation rules
    - Returns count of executed automations
  
  3. Security
    - Uses SECURITY DEFINER to bypass RLS
    - Only authenticated users can call it
*/

CREATE OR REPLACE FUNCTION execute_project_automations(
  p_project_id uuid,
  p_trigger_type text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_project record;
  v_status record;
  v_parent_status record;
  v_main_status_name text;
  v_rule record;
  v_executed_count integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- Get project details
  SELECT * INTO v_project
  FROM projects
  WHERE id = p_project_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;
  
  -- Get status details
  SELECT * INTO v_status
  FROM project_statuses
  WHERE id = v_project.status_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Status not found'
    );
  END IF;
  
  -- Determine main status name
  v_main_status_name := v_status.name;
  
  IF v_status.parent_status_id IS NOT NULL THEN
    SELECT name INTO v_parent_status
    FROM project_statuses
    WHERE id = v_status.parent_status_id;
    
    IF FOUND THEN
      v_main_status_name := v_parent_status.name;
    END IF;
  END IF;
  
  -- Find and execute matching automation rules
  FOR v_rule IN
    SELECT *
    FROM automation_rules
    WHERE main_status = v_main_status_name
      AND trigger_type = p_trigger_type
      AND is_active = true
      AND (project_type_id = v_project.project_type_id OR project_type_id IS NULL)
  LOOP
    BEGIN
      -- Execute based on action type
      IF v_rule.action_type = 'add_label' THEN
        -- Check if label already exists
        IF NOT EXISTS (
          SELECT 1
          FROM project_labels
          WHERE project_id = p_project_id
            AND label_id = (v_rule.action_config->>'label_id')::uuid
        ) THEN
          -- Add label
          INSERT INTO project_labels (project_id, label_id)
          VALUES (p_project_id, (v_rule.action_config->>'label_id')::uuid);
          
          v_executed_count := v_executed_count + 1;
          v_results := v_results || jsonb_build_object(
            'rule', v_rule.name,
            'action', 'add_label',
            'status', 'success'
          );
        ELSE
          v_results := v_results || jsonb_build_object(
            'rule', v_rule.name,
            'action', 'add_label',
            'status', 'skipped'
          );
        END IF;
        
      ELSIF v_rule.action_type = 'remove_label' THEN
        -- Remove label
        DELETE FROM project_labels
        WHERE project_id = p_project_id
          AND label_id = (v_rule.action_config->>'label_id')::uuid;
        
        v_executed_count := v_executed_count + 1;
        v_results := v_results || jsonb_build_object(
          'rule', v_rule.name,
          'action', 'remove_label',
          'status', 'success'
        );
        
      ELSIF v_rule.action_type = 'add_task' THEN
        -- Add task
        INSERT INTO project_tasks (
          project_id,
          title,
          description,
          deadline,
          assigned_to,
          completed
        )
        VALUES (
          p_project_id,
          v_rule.action_config->>'title',
          COALESCE(v_rule.action_config->>'description', ''),
          (v_rule.action_config->>'deadline')::timestamptz,
          (v_rule.action_config->>'assigned_to')::uuid,
          false
        );
        
        v_executed_count := v_executed_count + 1;
        v_results := v_results || jsonb_build_object(
          'rule', v_rule.name,
          'action', 'add_task',
          'status', 'success'
        );
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object(
        'rule', v_rule.name,
        'action', v_rule.action_type,
        'status', 'error',
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'executed', v_executed_count,
    'main_status', v_main_status_name,
    'results', v_results
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_project_automations(uuid, text) TO authenticated;