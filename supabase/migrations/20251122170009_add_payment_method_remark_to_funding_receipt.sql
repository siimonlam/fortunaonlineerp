/*
  # Add Payment Method Remark to Funding Receipt

  1. Changes
    - Add payment_method_remark field to funding_receipt table
    - This field stores additional information like cheque numbers, transaction IDs, etc.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funding_receipt' AND column_name = 'payment_method_remark'
  ) THEN
    ALTER TABLE funding_receipt ADD COLUMN payment_method_remark text;
  END IF;
END $$;
