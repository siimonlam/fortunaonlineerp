/*
  # Add Sales Source Detail Field to Clients

  1. Changes
    - Add `sales_source_detail` field to `clients` table
    - Add `sales_source_detail` field to `channel_partners` table
    - This field stores additional information when sales source is Seminar or Exhibition
  
  2. Notes
    - Field is nullable as it's only used for specific sales sources
*/

-- Add sales_source_detail to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS sales_source_detail TEXT;

-- Add sales_source_detail to channel_partners table
ALTER TABLE channel_partners 
ADD COLUMN IF NOT EXISTS sales_source_detail TEXT;
