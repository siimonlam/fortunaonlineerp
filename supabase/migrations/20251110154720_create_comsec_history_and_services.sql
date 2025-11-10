/*
  # Create Com Sec Client History and Services Tables

  1. New Tables
    - `comsec_client_history`
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, references comsec_clients) - Link to com sec client
      - `user_id` (uuid, references auth.users) - User who made the change
      - `action` (text) - Action type (e.g., 'updated', 'created')
      - `field_name` (text) - Field that was changed
      - `old_value` (text) - Previous value
      - `new_value` (text) - New value
      - `created_at` (timestamptz)

    - `comsec_client_services`
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, references comsec_clients) - Link to com sec client
      - `service_type` (text) - Type of service (company_bank_registration, virtual_office, company_secretary)
      - `service_date` (date) - Service date (for company_bank_registration)
      - `start_date` (date) - Service start date (for virtual_office, company_secretary)
      - `end_date` (date) - Service end date (for virtual_office, company_secretary)
      - `is_paid` (boolean, default false) - Payment status
      - `paid_date` (date) - Payment date
      - `remarks` (text) - Additional notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Security
    - Enable RLS on both tables
    - Users can view all history and services
    - Users can insert/update services
    - History is automatically tracked

  3. Important Notes
    - History table tracks all changes to com sec clients
    - Services table stores service information with payment tracking
*/

-- Create comsec_client_history table
CREATE TABLE IF NOT EXISTS comsec_client_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

-- Create comsec_client_services table
CREATE TABLE IF NOT EXISTS comsec_client_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('company_bank_registration', 'virtual_office', 'company_secretary')),
  service_date date,
  start_date date,
  end_date date,
  is_paid boolean DEFAULT false,
  paid_date date,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_comsec_client_history_client ON comsec_client_history(comsec_client_id);
CREATE INDEX IF NOT EXISTS idx_comsec_client_history_created_at ON comsec_client_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comsec_client_services_client ON comsec_client_services(comsec_client_id);
CREATE INDEX IF NOT EXISTS idx_comsec_client_services_type ON comsec_client_services(service_type);

-- Enable RLS
ALTER TABLE comsec_client_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE comsec_client_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comsec_client_history

CREATE POLICY "Authenticated users can view all history"
  ON comsec_client_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert history"
  ON comsec_client_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for comsec_client_services

CREATE POLICY "Authenticated users can view all services"
  ON comsec_client_services
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert services"
  ON comsec_client_services
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update services"
  ON comsec_client_services
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete services"
  ON comsec_client_services
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comsec_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comsec_services_updated_at
  BEFORE UPDATE ON comsec_client_services
  FOR EACH ROW
  EXECUTE FUNCTION update_comsec_services_updated_at();