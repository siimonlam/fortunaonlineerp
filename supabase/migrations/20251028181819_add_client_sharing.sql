/*
  # Add client sharing functionality

  1. New Tables
    - `client_access`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - Composite unique constraint on (client_id, user_id)

  2. Changes to clients table
    - Add `sales_person_id` field to track who's responsible for the client

  3. Security
    - Enable RLS on client_access table
    - Update clients RLS to allow access based on:
      * Creator
      * Sales person
      * Users in client_access table
*/

-- Create client_access table for sharing
CREATE TABLE IF NOT EXISTS client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Add sales_person_id to clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'sales_person_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN sales_person_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Enable RLS on client_access
ALTER TABLE client_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_access

-- Users can view access entries for clients they have access to
CREATE POLICY "Users can view client access for accessible clients"
  ON client_access
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_access.client_id
      AND (
        clients.created_by = auth.uid()
        OR clients.sales_person_id = auth.uid()
      )
    )
  );

-- Creators and sales persons can grant access
CREATE POLICY "Creators and sales persons can grant access"
  ON client_access
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_access.client_id
      AND (
        clients.created_by = auth.uid()
        OR clients.sales_person_id = auth.uid()
      )
    )
  );

-- Creators and sales persons can revoke access
CREATE POLICY "Creators and sales persons can revoke access"
  ON client_access
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_access.client_id
      AND (
        clients.created_by = auth.uid()
        OR clients.sales_person_id = auth.uid()
      )
    )
  );

-- Update clients SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON clients;

CREATE POLICY "Users can view accessible clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR sales_person_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM client_access
      WHERE client_access.client_id = clients.id
      AND client_access.user_id = auth.uid()
    )
  );

-- Update clients UPDATE policy
DROP POLICY IF EXISTS "Creators can update their clients" ON clients;

CREATE POLICY "Creators and sales persons can update clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR sales_person_id = auth.uid()
  )
  WITH CHECK (
    created_by = auth.uid()
    OR sales_person_id = auth.uid()
  );

-- Update clients DELETE policy
DROP POLICY IF EXISTS "Creators can delete their clients" ON clients;

CREATE POLICY "Creators and sales persons can delete clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR sales_person_id = auth.uid()
  );
