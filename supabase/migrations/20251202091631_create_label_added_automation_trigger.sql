/*
  # Create Label Added Automation Trigger

  1. New Trigger
    - Creates a trigger on `project_labels` table
    - Executes automation rules when a label is added to a project
    - Calls the execute-automation-rules edge function
    - Only triggers on INSERT operations

  2. Purpose
    - Enable automation rules to be triggered when specific labels are added to projects
    - Allows workflows like: "When 'Urgent' label is added, create a task"
*/

CREATE OR REPLACE FUNCTION trigger_label_added_automation()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  project_type_id TEXT;
BEGIN
  webhook_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/execute-automation-rules';

  SELECT p.project_type_id INTO project_type_id
  FROM projects p
  WHERE p.id = NEW.project_id;

  PERFORM net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'trigger_type', 'label_added',
      'project_id', NEW.project_id,
      'project_type_id', project_type_id,
      'trigger_data', jsonb_build_object(
        'label_id', NEW.label_id
      )
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_label_added_trigger_automation ON project_labels;

CREATE TRIGGER on_label_added_trigger_automation
  AFTER INSERT ON project_labels
  FOR EACH ROW
  EXECUTE FUNCTION trigger_label_added_automation();
