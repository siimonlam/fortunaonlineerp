/*
  # Restructure Com Sec Services System

  1. Changes
    - Drop the old `comsec_client_services` table
    - Create `comsec_services` master table with predefined services
    - Create `comsec_client_service_subscriptions` table to link services to clients
    - Add invoice_number and company_code fields to track service billing
    - Auto-populate master services list

  2. New Tables
    - `comsec_services` (Master list of all services offered)
      - `id` (uuid, primary key)
      - `service_name` (text, unique) - Display name of the service
      - `service_type` (text, unique) - Internal identifier
      - `description` (text) - Service description
      - `is_active` (boolean, default true) - Whether service is currently offered
      - `created_at` (timestamptz)

    - `comsec_client_service_subscriptions` (Links services to clients)
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, references comsec_clients)
      - `service_id` (uuid, references comsec_services)
      - `company_code` (text) - Client's company code
      - `invoice_number` (text) - Invoice number for this service
      - `service_date` (date) - Service date (for one-time services)
      - `start_date` (date) - Start date (for recurring services)
      - `end_date` (date) - End date (for recurring services)
      - `is_paid` (boolean, default false)
      - `paid_date` (date)
      - `remarks` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  3. Security
    - Enable RLS on both tables
    - All authenticated users can view services
    - Only authenticated users can manage subscriptions

  4. Important Notes
    - Three predefined services are automatically created
    - Each client can have multiple service subscriptions
    - Service subscriptions are linked to invoices via invoice_number
*/

-- Drop the old services table
DROP TABLE IF EXISTS comsec_client_services CASCADE;

-- Create master services table
CREATE TABLE IF NOT EXISTS comsec_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text UNIQUE NOT NULL,
  service_type text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create client service subscriptions table
CREATE TABLE IF NOT EXISTS comsec_client_service_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES comsec_services(id) ON DELETE RESTRICT NOT NULL,
  company_code text,
  invoice_number text,
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
CREATE INDEX IF NOT EXISTS idx_comsec_services_type ON comsec_services(service_type);
CREATE INDEX IF NOT EXISTS idx_comsec_services_active ON comsec_services(is_active);
CREATE INDEX IF NOT EXISTS idx_comsec_subscriptions_client ON comsec_client_service_subscriptions(comsec_client_id);
CREATE INDEX IF NOT EXISTS idx_comsec_subscriptions_service ON comsec_client_service_subscriptions(service_id);
CREATE INDEX IF NOT EXISTS idx_comsec_subscriptions_company_code ON comsec_client_service_subscriptions(company_code);
CREATE INDEX IF NOT EXISTS idx_comsec_subscriptions_invoice ON comsec_client_service_subscriptions(invoice_number);

-- Enable RLS
ALTER TABLE comsec_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE comsec_client_service_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comsec_services
CREATE POLICY "Authenticated users can view all services"
  ON comsec_services
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert services"
  ON comsec_services
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update services"
  ON comsec_services
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for comsec_client_service_subscriptions
CREATE POLICY "Authenticated users can view all subscriptions"
  ON comsec_client_service_subscriptions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert subscriptions"
  ON comsec_client_service_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update subscriptions"
  ON comsec_client_service_subscriptions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete subscriptions"
  ON comsec_client_service_subscriptions
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comsec_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comsec_subscriptions_updated_at
  BEFORE UPDATE ON comsec_client_service_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_comsec_subscriptions_updated_at();

-- Insert predefined services
INSERT INTO comsec_services (service_name, service_type, description, is_active)
VALUES
  ('Company Bank Registration', 'company_bank_registration', 'One-time service for company and bank registration', true),
  ('Company Secretary', 'company_secretary', 'Ongoing company secretary services with start and end dates', true),
  ('Virtual Office', 'virtual_office', 'Virtual office services with start and end dates', true)
ON CONFLICT (service_type) DO NOTHING;
