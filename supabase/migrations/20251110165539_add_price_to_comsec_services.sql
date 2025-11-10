/*
  # Add Price Field to Com Sec Services

  1. Changes
    - Add `price` field to `comsec_services` table to store the default price for each service
    - Add `amount` field to `comsec_client_service_subscriptions` to store the actual charged amount for specific subscriptions
    - Update existing services with default prices

  2. Fields Added
    - `comsec_services.price` (numeric) - Default price for the service
    - `comsec_client_service_subscriptions.amount` (numeric) - Actual amount charged for this subscription

  3. Important Notes
    - Price in master services table is the default/base price
    - Amount in subscriptions table is the actual price charged (can be customized per client)
    - Both fields allow customization and updates
*/

-- Add price field to comsec_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_services' AND column_name = 'price'
  ) THEN
    ALTER TABLE comsec_services ADD COLUMN price numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add amount field to comsec_client_service_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_client_service_subscriptions' AND column_name = 'amount'
  ) THEN
    ALTER TABLE comsec_client_service_subscriptions ADD COLUMN amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Update existing services with default prices (can be adjusted later)
UPDATE comsec_services SET price = 500.00 WHERE service_type = 'company_bank_registration' AND price = 0;
UPDATE comsec_services SET price = 300.00 WHERE service_type = 'company_secretary' AND price = 0;
UPDATE comsec_services SET price = 200.00 WHERE service_type = 'virtual_office' AND price = 0;
