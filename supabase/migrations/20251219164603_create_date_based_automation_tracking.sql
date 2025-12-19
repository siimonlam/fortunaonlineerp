/*
  # Create Date-Based Automation Tracking Table

  1. New Tables
    - `date_based_automation_executions`
      - `id` (uuid, primary key)
      - `automation_rule_id` (uuid, foreign key to automation_rules)
      - `project_id` (uuid, foreign key to projects)
      - `executed_at` (timestamptz) - When the automation was executed
      - `date_field_value` (date) - The value of the date field when executed
      - `created_at` (timestamptz)

  2. Purpose
    - Track execution of "days_after_date" and "days_before_date" automation rules
    - Prevent duplicate executions for the same rule/project combination
    - Store the date field value to track what date triggered the execution

  3. Security
    - Enable RLS
    - Allow authenticated users to read executions
    - Only service role can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS date_based_automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  executed_at timestamptz NOT NULL DEFAULT now(),
  date_field_value date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(automation_rule_id, project_id)
);

ALTER TABLE date_based_automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view date-based automation executions"
  ON date_based_automation_executions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_date_based_automation_executions_rule ON date_based_automation_executions(automation_rule_id);
CREATE INDEX idx_date_based_automation_executions_project ON date_based_automation_executions(project_id);
CREATE INDEX idx_date_based_automation_executions_executed_at ON date_based_automation_executions(executed_at);
