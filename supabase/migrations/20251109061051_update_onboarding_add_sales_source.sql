/*
  # Update Onboarding Function to Set Sales Source

  1. Changes
    - Update `create_client_onboarding` function to automatically set sales_source as "website"
    - This tracks that the client registered through the website onboarding form

  2. Purpose
    - Automatically categorize clients by their registration source
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
    name,
    contact_person,
    email,
    phone,
    industry,
    sales_source,
    created_by
  )
  VALUES (
    p_company_name,
    p_contact_name,
    p_email,
    p_phone,
    p_industry,
    'website',
    auth.uid()
  )
  RETURNING id INTO v_client_id;
  
  RETURN v_client_id;
END;
$$;
