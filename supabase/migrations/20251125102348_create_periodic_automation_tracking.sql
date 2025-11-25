/*
  # Create Periodic Automation Tracking

  1. New Tables
    - `periodic_automation_executions`
      - `id` (uuid, primary key)
      - `automation_rule_id` (uuid, foreign key to automation_rules)
      - `project_id` (uuid, foreign key to projects)
      - `last_executed_at` (timestamptz) - When the automation was last executed for this project
      - `next_execution_at` (timestamptz) - When it should be executed next
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Indexes
    - Index on automation_rule_id for fast lookups
    - Index on next_execution_at for finding due automations
  
  3. Security
    - Enable RLS
    - Service role can access all records
*/

-- Create tracking table
CREATE TABLE IF NOT EXISTS periodic_automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id uuid REFERENCES automation_rules(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  last_executed_at timestamptz DEFAULT now(),
  next_execution_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(automation_rule_id, project_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_periodic_executions_rule ON periodic_automation_executions(automation_rule_id);
CREATE INDEX IF NOT EXISTS idx_periodic_executions_next ON periodic_automation_executions(next_execution_at);
CREATE INDEX IF NOT EXISTS idx_periodic_executions_project ON periodic_automation_executions(project_id);

-- Enable RLS
ALTER TABLE periodic_automation_executions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (needed for edge functions)
CREATE POLICY "Service role has full access to periodic executions"
  ON periodic_automation_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);