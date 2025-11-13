/*
  # Add payment_date column to funding_invoice table

  1. Changes
    - Add `payment_date` column to `funding_invoice` table
      - Type: date
      - Nullable: true (not all invoices are paid yet)
      - Used to track when an invoice payment was received

  2. Notes
    - This field helps track the actual payment date for invoices
    - When payment_status is 'Paid', this date should be set
*/

-- Add payment_date column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funding_invoice' AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE funding_invoice ADD COLUMN payment_date date;
  END IF;
END $$;

-- Create index for payment_date for faster queries
CREATE INDEX IF NOT EXISTS idx_funding_invoice_payment_date ON funding_invoice(payment_date);
