/*
  # Add Chinese Company Name to Channel Partners

  1. Changes
    - Add `company_name_chinese` column to `channel_partners` table

  2. Details
    - Column is text type and nullable
    - Allows storing Chinese company names alongside English names for channel partners
    - Complements the existing company_name_chinese fields in clients, projects, and comsec_clients tables
*/

-- Add company_name_chinese to channel_partners table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_partners' AND column_name = 'company_name_chinese'
  ) THEN
    ALTER TABLE channel_partners ADD COLUMN company_name_chinese text;
  END IF;
END $$;
