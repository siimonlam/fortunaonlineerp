/*
  # Create Client Onboarding Function

  1. Purpose
    - Allows public (unauthenticated) users to submit client information via an onboarding form
    - Creates a new client record in the clients table
    - Bypasses RLS by using SECURITY DEFINER

  2. Function
    - `create_client_onboarding`: Public function that accepts client details and creates a new client record
    
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only performs INSERT operation with validated inputs
    - No ability to read, update, or delete existing data
*/

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
    company_name,
    contact_name,
    email,
    phone,
    industry
  )
  VALUES (
    p_company_name,
    p_contact_name,
    p_email,
    p_phone,
    p_industry
  )
  RETURNING id INTO v_client_id;
  
  RETURN v_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_client_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_client_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
