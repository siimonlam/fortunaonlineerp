/*
  # Fix Client Onboarding Function

  1. Purpose
    - Updates the create_client_onboarding function to use correct column names
    - Maps form fields to actual database columns: name, contact_person

  2. Changes
    - Uses `name` instead of `company_name`
    - Uses `contact_person` instead of `contact_name`
    - Sets created_by to NULL for onboarding submissions
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
    created_by
  )
  VALUES (
    p_company_name,
    p_contact_name,
    p_email,
    p_phone,
    p_industry,
    NULL
  )
  RETURNING id INTO v_client_id;
  
  RETURN v_client_id;
END;
$$;
