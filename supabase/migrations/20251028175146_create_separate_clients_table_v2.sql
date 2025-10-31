/*
  # Create separate clients table

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text, required) - Client company name
      - `contact_person` (text) - Main contact person
      - `email` (text) - Contact email
      - `phone` (text) - Contact phone
      - `address` (text) - Client address
      - `notes` (text) - Additional notes
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to existing tables
    - Add `client_id` to projects table to link projects to clients
    - Remove "Client" project type and its statuses

  3. Security
    - Enable RLS on clients table
    - Users can view all clients (authenticated)
    - Only creators can update/delete their clients
    - Any authenticated user can create clients
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  notes text,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add client_id to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN client_id uuid REFERENCES clients(id);
  END IF;
END $$;

-- Remove the client-specific fields from projects since they should be in clients table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'client_name'
  ) THEN
    ALTER TABLE projects DROP COLUMN client_name;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'client_email'
  ) THEN
    ALTER TABLE projects DROP COLUMN client_email;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'client_phone'
  ) THEN
    ALTER TABLE projects DROP COLUMN client_phone;
  END IF;
END $$;

-- Enable RLS on clients table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients table

-- SELECT: All authenticated users can view all clients
CREATE POLICY "Authenticated users can view all clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Any authenticated user can create clients
CREATE POLICY "Authenticated users can create clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- UPDATE: Only creator can update
CREATE POLICY "Creators can update their clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- DELETE: Only creator can delete
CREATE POLICY "Creators can delete their clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Delete statuses for "Client" project type first
DELETE FROM statuses 
WHERE project_type_id = (SELECT id FROM project_types WHERE name = 'Client');

-- Then delete "Client" project type
DELETE FROM project_types WHERE name = 'Client';
