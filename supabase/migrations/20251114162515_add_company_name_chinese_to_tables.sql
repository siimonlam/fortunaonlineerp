/*
  # Add Chinese Company Name Fields

  1. Changes
    - Add `company_name_chinese` column to `clients` table
    - Add `company_name_chinese` column to `projects` table  
    - Add `company_name_chinese` column to `comsec_clients` table

  2. Details
    - All columns are text type and nullable
    - Allows storing Chinese company names alongside English names
    - Useful for bilingual company management
*/

-- Add company_name_chinese to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'company_name_chinese'
  ) THEN
    ALTER TABLE clients ADD COLUMN company_name_chinese text;
  END IF;
END $$;

-- Add company_name_chinese to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'company_name_chinese'
  ) THEN
    ALTER TABLE projects ADD COLUMN company_name_chinese text;
  END IF;
END $$;

-- Add company_name_chinese to comsec_clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comsec_clients' AND column_name = 'company_name_chinese'
  ) THEN
    ALTER TABLE comsec_clients ADD COLUMN company_name_chinese text;
  END IF;
END $$;