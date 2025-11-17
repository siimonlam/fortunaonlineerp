/*
  # Add Commission Rate to Channel Partners

  1. Changes
    - Add `commission_rate` column to `channel_partners` table
      - Stores the commission rate as a percentage (e.g., 15 for 15%)
      - Numeric type with 2 decimal precision
      - Optional field (can be null)
      - Default value is NULL

  2. Notes
    - This allows tracking commission rates for each channel partner
    - The rate is stored as a percentage value
*/

-- Add commission_rate column to channel_partners table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_partners' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE channel_partners ADD COLUMN commission_rate numeric(5, 2);
  END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN channel_partners.commission_rate IS 'Commission rate as a percentage (e.g., 15.00 for 15%)';