/*
  # Create Automation Rules Schema

  1. New Tables
    - `automation_rules`
      - `id` (uuid, primary key)
      - `name` (text) - Friendly name for the rule
      - `project_type_id` (uuid) - Foreign key to project_types
      - `main_status` (text) - The main status this applies to (Hi-Po, Pre-Submission, Q&A, Final Report)
      - `trigger_type` (text) - Type of trigger (hkpc_date_set, task_completed, status_changed, periodic)
      - `trigger_config` (jsonb) - Configuration for the trigger (task_id for task triggers, etc.)
      - `action_type` (text) - Type of action (add_task, add_label, remove_label)
      - `action_config` (jsonb) - Configuration for the action (task details, label_id, etc.)
      - `is_active` (boolean) - Whether the rule is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `automation_rules` table
    - Add policies for admin users only
*/

CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_type_id uuid REFERENCES project_types(id) ON DELETE CASCADE,
  main_status text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('hkpc_date_set', 'task_completed', 'status_changed', 'periodic')),
  trigger_config jsonb DEFAULT '{}'::jsonb,
  action_type text NOT NULL CHECK (action_type IN ('add_task', 'add_label', 'remove_label')),
  action_config jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view automation rules"
  ON automation_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert automation rules"
  ON automation_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update automation rules"
  ON automation_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete automation rules"
  ON automation_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_automation_rules_project_type ON automation_rules(project_type_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_type ON automation_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_is_active ON automation_rules(is_active);
