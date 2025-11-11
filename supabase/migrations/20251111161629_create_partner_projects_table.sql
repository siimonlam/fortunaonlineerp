/*
  # Create Partner Projects Table

  1. New Table
    - `partner_projects`
      - `id` (uuid, primary key)
      - `project_reference` (text) - The FP reference number
      - `channel_partner_id` (uuid) - Foreign key to channel_partners
      - `channel_partner_name` (text) - Denormalized for quick display
      - `channel_partner_reference` (text) - The CP reference number
      - `project_amount` (numeric) - Total project amount
      - `date` (date) - Project date
      - `paid_status` (boolean) - Whether project payment received
      - `commission_rate` (numeric) - Commission percentage (e.g., 10.5 for 10.5%)
      - `commission_amount` (numeric) - Calculated commission amount
      - `commission_paid_status` (boolean) - Whether commission has been paid
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Purpose
    - Track projects associated with channel partners
    - Manage commission calculations and payments
    - Provide visibility into partner project revenue
    
  3. Security
    - Enable RLS
    - Authenticated users can view all partner projects
    - Only admins can insert, update, or delete partner projects
*/

-- Create partner_projects table
CREATE TABLE IF NOT EXISTS partner_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_reference text,
  channel_partner_id uuid REFERENCES channel_partners(id) ON DELETE SET NULL,
  channel_partner_name text NOT NULL,
  channel_partner_reference text,
  project_amount numeric(12, 2) DEFAULT 0,
  date date,
  paid_status boolean DEFAULT false,
  commission_rate numeric(5, 2) DEFAULT 0,
  commission_amount numeric(12, 2) DEFAULT 0,
  commission_paid_status boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE partner_projects ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view partner projects
CREATE POLICY "Authenticated users can view partner projects"
  ON partner_projects
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert partner projects
CREATE POLICY "Admins can insert partner projects"
  ON partner_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can update partner projects
CREATE POLICY "Admins can update partner projects"
  ON partner_projects
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

-- Only admins can delete partner projects
CREATE POLICY "Admins can delete partner projects"
  ON partner_projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_partner_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER set_partner_projects_updated_at
  BEFORE UPDATE ON partner_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_projects_updated_at();

-- Create function to auto-calculate commission amount
CREATE OR REPLACE FUNCTION calculate_commission_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_amount IS NOT NULL AND NEW.commission_rate IS NOT NULL THEN
    NEW.commission_amount := (NEW.project_amount * NEW.commission_rate / 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for commission calculation
CREATE TRIGGER set_commission_amount
  BEFORE INSERT OR UPDATE ON partner_projects
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_amount();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_partner_projects_channel_partner_id 
  ON partner_projects(channel_partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_projects_project_reference 
  ON partner_projects(project_reference);
CREATE INDEX IF NOT EXISTS idx_partner_projects_date 
  ON partner_projects(date);

-- Add comments for documentation
COMMENT ON TABLE partner_projects IS 'Projects associated with channel partners for commission tracking';
COMMENT ON COLUMN partner_projects.project_reference IS 'Reference to the funding project (e.g., FP00001)';
COMMENT ON COLUMN partner_projects.commission_rate IS 'Commission percentage (e.g., 10.5 for 10.5%)';
COMMENT ON COLUMN partner_projects.commission_amount IS 'Auto-calculated commission amount based on project_amount * commission_rate';
