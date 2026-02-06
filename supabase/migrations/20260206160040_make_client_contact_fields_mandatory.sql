/*
  # Make contact fields mandatory for clients

  1. Changes
    - Make contact_person, email, and phone fields NOT NULL in clients table
    - Update any existing null values to prevent constraint violations

  2. Security
    - No changes to RLS policies
    - Ensures data quality by enforcing mandatory contact information
*/

-- First, update any existing NULL values to prevent constraint violations
UPDATE clients
SET contact_person = ''
WHERE contact_person IS NULL;

UPDATE clients
SET email = ''
WHERE email IS NULL;

UPDATE clients
SET phone = ''
WHERE phone IS NULL;

-- Now add NOT NULL constraints
ALTER TABLE clients
ALTER COLUMN contact_person SET NOT NULL;

ALTER TABLE clients
ALTER COLUMN email SET NOT NULL;

ALTER TABLE clients
ALTER COLUMN phone SET NOT NULL;
