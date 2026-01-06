/*
  # Fix Client Onboarding Function - Parent Client ID Type

  1. Changes
    - Drop existing function
    - Create updated function with correct parent_client_id type (TEXT instead of UUID)
  
  2. Purpose
    - Match the actual column type in the clients table
*/

-- Drop old function
DROP FUNCTION IF EXISTS create_client_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, UUID, UUID, TEXT);

-- Create updated function with correct type
CREATE OR REPLACE FUNCTION create_client_onboarding(
  p_company_name TEXT,
  p_contact_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_industry TEXT,
  p_company_name_chinese TEXT DEFAULT NULL,
  p_brand_name TEXT DEFAULT NULL,
  p_abbreviation TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_other_industry TEXT DEFAULT NULL,
  p_is_ecommerce BOOLEAN DEFAULT FALSE,
  p_notes TEXT DEFAULT NULL,
  p_sales_source TEXT DEFAULT NULL,
  p_sales_source_detail TEXT DEFAULT NULL,
  p_sales_person_id UUID DEFAULT NULL,
  p_parent_client_id TEXT DEFAULT NULL,
  p_parent_company_name TEXT DEFAULT NULL
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
    company_name_chinese,
    brand_name,
    abbreviation,
    contact_person,
    email,
    phone,
    address,
    industry,
    other_industry,
    is_ecommerce,
    notes,
    sales_source,
    sales_source_detail,
    sales_person_id,
    parent_client_id,
    parent_company_name
  )
  VALUES (
    p_company_name,
    p_company_name_chinese,
    p_brand_name,
    p_abbreviation,
    p_contact_name,
    p_email,
    p_phone,
    p_address,
    p_industry,
    p_other_industry,
    p_is_ecommerce,
    p_notes,
    p_sales_source,
    p_sales_source_detail,
    p_sales_person_id,
    p_parent_client_id,
    p_parent_company_name
  )
  RETURNING id INTO v_client_id;
  
  RETURN v_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_client_onboarding TO anon;
GRANT EXECUTE ON FUNCTION create_client_onboarding TO authenticated;
