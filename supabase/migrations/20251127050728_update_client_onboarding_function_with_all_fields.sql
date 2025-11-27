/*
  # Update Client Onboarding Function with All Fields

  1. Changes
    - Drop the old function
    - Create updated function with all client fields matching the edit form
    - Adds support for:
      - company_name_chinese
      - abbreviation
      - address
      - other_industry
      - is_ecommerce
      - notes
      - sales_source
  
  2. Security
    - Function maintains SECURITY DEFINER to bypass RLS
    - Only performs INSERT operation with validated inputs
*/

-- Drop old function
DROP FUNCTION IF EXISTS create_client_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Create updated function with all fields
CREATE OR REPLACE FUNCTION create_client_onboarding(
  p_company_name TEXT,
  p_contact_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_industry TEXT,
  p_company_name_chinese TEXT DEFAULT NULL,
  p_abbreviation TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_other_industry TEXT DEFAULT NULL,
  p_is_ecommerce BOOLEAN DEFAULT FALSE,
  p_notes TEXT DEFAULT NULL,
  p_sales_source TEXT DEFAULT NULL
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
    abbreviation,
    contact_person,
    email,
    phone,
    address,
    industry,
    other_industry,
    is_ecommerce,
    notes,
    sales_source
  )
  VALUES (
    p_company_name,
    p_company_name_chinese,
    p_abbreviation,
    p_contact_name,
    p_email,
    p_phone,
    p_address,
    p_industry,
    p_other_industry,
    p_is_ecommerce,
    p_notes,
    p_sales_source
  )
  RETURNING id INTO v_client_id;
  
  RETURN v_client_id;
END;
$$;

-- Grant permissions (using named parameter notation for flexibility)
GRANT EXECUTE ON FUNCTION create_client_onboarding TO anon;
GRANT EXECUTE ON FUNCTION create_client_onboarding TO authenticated;
