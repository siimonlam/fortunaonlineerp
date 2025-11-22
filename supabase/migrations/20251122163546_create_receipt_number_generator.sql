/*
  # Create Receipt Number Generator

  1. Changes
    - Create function to generate sequential receipt numbers
    - Format: REC + 6-digit number (e.g., REC000001)
*/

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
  receipt_num TEXT;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN receipt_number ~ '^REC[0-9]+$' 
        THEN CAST(SUBSTRING(receipt_number FROM 4) AS INTEGER)
        ELSE 0
      END
    ), 0
  ) + 1
  INTO next_num
  FROM funding_receipt;
  
  receipt_num := 'REC' || LPAD(next_num::TEXT, 6, '0');
  
  RETURN receipt_num;
END;
$$;
