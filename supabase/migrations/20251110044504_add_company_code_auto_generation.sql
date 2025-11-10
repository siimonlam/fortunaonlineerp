/*
  # Add Company Code Auto-Generation for Com Sec Clients

  1. Changes
    - Create function to generate next company code starting at A00001
    - Create trigger to automatically assign company code on insert
    - The format is: A + 5-digit zero-padded number (A00001, A00002, etc.)

  2. Security
    - Function is security definer to allow execution during RLS-protected inserts
*/

-- Function to generate next company code
CREATE OR REPLACE FUNCTION generate_company_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_code TEXT;
  last_number INTEGER;
  next_number INTEGER;
  next_code TEXT;
BEGIN
  -- Get the last company code
  SELECT company_code INTO last_code
  FROM comsec_clients
  WHERE company_code ~ '^A\d{5}$'
  ORDER BY company_code DESC
  LIMIT 1;

  -- If no codes exist, start with A00001
  IF last_code IS NULL THEN
    RETURN 'A00001';
  END IF;

  -- Extract the numeric part and increment
  last_number := CAST(SUBSTRING(last_code FROM 2) AS INTEGER);
  next_number := last_number + 1;

  -- Format the next code
  next_code := 'A' || LPAD(next_number::TEXT, 5, '0');

  RETURN next_code;
END;
$$;

-- Trigger function to auto-assign company code
CREATE OR REPLACE FUNCTION auto_assign_company_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only assign if company_code is NULL
  IF NEW.company_code IS NULL THEN
    NEW.company_code := generate_company_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_assign_company_code ON comsec_clients;
CREATE TRIGGER trigger_auto_assign_company_code
  BEFORE INSERT ON comsec_clients
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_company_code();
