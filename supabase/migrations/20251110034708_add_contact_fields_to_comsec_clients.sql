/*
  # Add Contact and Sales Fields to Com Sec Clients

  1. Changes
    - Add contact_person field to comsec_clients
    - Add email field to comsec_clients
    - Add phone field to comsec_clients
    - Add address field to comsec_clients
    - Add sales_source field to comsec_clients
    - Add sales_person_id field to comsec_clients (foreign key to staff)

  2. Purpose
    - Align comsec_clients table with the standard client fields
    - Enable storing contact and sales information directly in comsec records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_clients' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE comsec_clients ADD COLUMN contact_person text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_clients' AND column_name = 'email'
  ) THEN
    ALTER TABLE comsec_clients ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_clients' AND column_name = 'phone'
  ) THEN
    ALTER TABLE comsec_clients ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_clients' AND column_name = 'address'
  ) THEN
    ALTER TABLE comsec_clients ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_clients' AND column_name = 'sales_source'
  ) THEN
    ALTER TABLE comsec_clients ADD COLUMN sales_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_clients' AND column_name = 'sales_person_id'
  ) THEN
    ALTER TABLE comsec_clients ADD COLUMN sales_person_id uuid REFERENCES staff(id);
  END IF;
END $$;