/*
  # Make created_by Nullable and Update Onboarding Function

  1. Changes
    - Make `created_by` column nullable in clients table
    - Update `create_client_onboarding` to use authenticated user ID for created_by
    - This allows funding clients to create their own client records

  2. Security
    - Function remains SECURITY DEFINER to bypass RLS
    - Sets created_by to the authenticated user making the request
*/

ALTER TABLE clients 
ALTER COLUMN created_by DROP NOT NULL;

CREATE OR REPLACE FUNCTION create_client_onboarding(
  p_company_name TEXT,
  p_contact_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_industry TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  INSERT INTO clients (
    name,
    contact_person,
    email,
    phone,
    industry,
    created_by
  )
  VALUES (
    p_company_name,
    p_contact_name,
    p_email,
    p_phone,
    p_industry,
    auth.uid()
  )
  RETURNING id INTO v_client_id;
  
  RETURN v_client_id;
END;
$$;
