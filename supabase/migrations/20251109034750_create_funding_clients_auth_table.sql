/*
  # Create funding_clients authentication table

  1. New Tables
    - `funding_clients`
      - `id` (uuid, primary key) - Links to auth.users
      - `company_name` (text, required) - Client company name
      - `contact_name` (text, required) - Primary contact person
      - `email` (text, unique, required) - Login email
      - `phone` (text) - Contact phone
      - `industry` (text) - Industry sector
      - `is_approved` (boolean) - Whether client is approved to access system
      - `approved_by` (uuid) - Staff member who approved access
      - `approved_at` (timestamptz) - When access was approved
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Purpose
    - This table stores external clients who register through the onboarding page
    - After registration, they can login with email/password
    - Their auth.users.id links to this table
    - Staff can approve/manage their access

  3. Security
    - Enable RLS on funding_clients table
    - Clients can only view their own record
    - Staff can view all funding_clients
    - Only system can insert (via registration function)
    - Staff can update approval status
*/

-- Create funding_clients table
CREATE TABLE IF NOT EXISTS funding_clients (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  industry text,
  is_approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE funding_clients ENABLE ROW LEVEL SECURITY;

-- Clients can view their own record
CREATE POLICY "Funding clients can view own record"
  ON funding_clients
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Staff can view all funding clients
CREATE POLICY "Staff can view all funding clients"
  ON funding_clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'staff')
    )
  );

-- Staff can update funding clients (for approval)
CREATE POLICY "Staff can update funding clients"
  ON funding_clients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'staff')
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_funding_clients_email ON funding_clients(email);
CREATE INDEX IF NOT EXISTS idx_funding_clients_approved ON funding_clients(is_approved);
