/*
  # Add Automated Status Change Notifications

  1. New Tables
    - `status_change_log`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `old_status_id` (uuid, references statuses)
      - `new_status_id` (uuid, references statuses)
      - `changed_by` (uuid, references staff)
      - `changed_at` (timestamptz)
      - `notification_sent` (boolean)

  2. Functions
    - `notify_status_change()` - Trigger function that logs status changes
    - `get_project_stakeholders()` - Helper function to get all users who should be notified

  3. Triggers
    - Automatically log status changes when project status updates

  4. Security
    - Enable RLS on status_change_log table
    - Add policies for viewing change logs
*/

-- Create status change log table
CREATE TABLE IF NOT EXISTS status_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  old_status_id uuid REFERENCES statuses(id),
  new_status_id uuid REFERENCES statuses(id) NOT NULL,
  changed_by uuid REFERENCES staff(id) NOT NULL,
  changed_at timestamptz DEFAULT now() NOT NULL,
  notification_sent boolean DEFAULT false,
  notification_error text
);

ALTER TABLE status_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view status changes for projects they can view"
  ON status_change_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = status_change_log.project_id
      AND (
        p.created_by = auth.uid()
        OR p.sales_person_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_permissions pp
          WHERE pp.project_id = p.id
          AND pp.user_id = auth.uid()
          AND pp.can_view = true
        )
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
        )
      )
    )
  );

-- Function to get all stakeholders for a project (users who should be notified)
CREATE OR REPLACE FUNCTION get_project_stakeholders(p_project_id uuid)
RETURNS TABLE(user_email text) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT s.email
  FROM staff s
  WHERE s.id IN (
    -- Creator
    SELECT p.created_by FROM projects p WHERE p.id = p_project_id
    UNION
    -- Sales person
    SELECT p.sales_person_id FROM projects p WHERE p.id = p_project_id AND p.sales_person_id IS NOT NULL
    UNION
    -- Users with permissions
    SELECT pp.user_id FROM project_permissions pp WHERE pp.project_id = p_project_id AND pp.can_view = true
  );
END;
$$;

-- Function to handle status change and trigger notification
CREATE OR REPLACE FUNCTION notify_status_change()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status_name text;
  v_new_status_name text;
  v_changed_by_email text;
  v_project_title text;
  v_stakeholder_emails text[];
BEGIN
  -- Only proceed if status actually changed
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    
    -- Log the status change
    INSERT INTO status_change_log (project_id, old_status_id, new_status_id, changed_by)
    VALUES (NEW.id, OLD.status_id, NEW.status_id, NEW.created_by);
    
    -- Get status names
    SELECT name INTO v_old_status_name FROM statuses WHERE id = OLD.status_id;
    SELECT name INTO v_new_status_name FROM statuses WHERE id = NEW.status_id;
    
    -- Get changed by email
    SELECT email INTO v_changed_by_email FROM staff WHERE id = NEW.created_by;
    
    -- Get project title
    v_project_title := NEW.title;
    
    -- Get all stakeholder emails
    SELECT array_agg(user_email) INTO v_stakeholder_emails
    FROM get_project_stakeholders(NEW.id)
    WHERE user_email IS NOT NULL;
    
    -- Log notification information (for demonstration)
    RAISE NOTICE 'Status change detected: Project "%" changed from "%" to "%" by "%"', 
      v_project_title, v_old_status_name, v_new_status_name, v_changed_by_email;
    RAISE NOTICE 'Would notify: %', v_stakeholder_emails;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on projects table
DROP TRIGGER IF EXISTS on_project_status_change ON projects;
CREATE TRIGGER on_project_status_change
  AFTER UPDATE OF status_id ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_status_change();

-- Enable realtime for status_change_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'status_change_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE status_change_log;
  END IF;
END $$;