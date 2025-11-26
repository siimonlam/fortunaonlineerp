/*
  # Convert Client Numbers and IDs to 'C' Format

  1. Changes
    - Change client_number from integer to text in clients table
    - Change client_id from uuid to text in comsec_clients table
    - Update all values to use 'C0002' format instead of numbers or UUIDs
    
  2. Notes
    - Converts numeric client numbers like 2 to 'C0002'
    - Replaces UUID client_id references with formatted client numbers
*/

-- Step 1: Convert clients.client_number from integer to text with C prefix
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_number_new text;
UPDATE clients SET client_number_new = 'C' || LPAD(client_number::text, 4, '0');
ALTER TABLE clients DROP COLUMN client_number;
ALTER TABLE clients RENAME COLUMN client_number_new TO client_number;

-- Step 2: Update parent_client_id fields to use C format
UPDATE clients 
SET parent_client_id = 'C' || LPAD(parent_client_id, 4, '0')
WHERE parent_client_id IS NOT NULL AND parent_client_id NOT LIKE 'C%';

UPDATE projects 
SET parent_client_id = 'C' || LPAD(parent_client_id, 4, '0')
WHERE parent_client_id IS NOT NULL AND parent_client_id NOT LIKE 'C%';

UPDATE comsec_clients 
SET parent_client_id = 'C' || LPAD(parent_client_id, 4, '0')
WHERE parent_client_id IS NOT NULL AND parent_client_id NOT LIKE 'C%';

-- Step 3: Convert comsec_clients.client_id from uuid to text
-- First create a temp table to store the mapping
CREATE TEMP TABLE comsec_client_mapping AS
SELECT cc.id, c.client_number as new_client_id
FROM comsec_clients cc
LEFT JOIN clients c ON cc.client_id = c.id
WHERE cc.client_id IS NOT NULL;

-- Add new column for text client_id
ALTER TABLE comsec_clients ADD COLUMN IF NOT EXISTS client_id_new text;

-- Update with mapped values
UPDATE comsec_clients cc
SET client_id_new = ccm.new_client_id
FROM comsec_client_mapping ccm
WHERE cc.id = ccm.id;

-- Drop old uuid column and rename new one
ALTER TABLE comsec_clients DROP COLUMN client_id;
ALTER TABLE comsec_clients RENAME COLUMN client_id_new TO client_id;