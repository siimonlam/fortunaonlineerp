/*
  # Add Marketing Project Fields

  1. Purpose
    - Add missing fields to marketing_projects table to match client fields
    - Enable comprehensive marketing project data collection

  2. New Columns
    - `abbreviation` (text) - Company abbreviation
    - `industry` (text) - Industry category
    - `other_industry` (text) - Custom industry if "Other" is selected
    - `is_ecommerce` (boolean) - Whether company does e-commerce
    - `channel_partner_id` (uuid) - Reference to channel partner
    - `parent_client_id` (text) - Parent client reference
    - `parent_company_name` (text) - Parent company name

  3. Notes
    - Using IF NOT EXISTS to prevent errors on re-run
    - All fields are nullable for flexibility
    - Maintains backward compatibility with existing records
*/

-- Add abbreviation field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_projects' AND column_name = 'abbreviation'
  ) THEN
    ALTER TABLE marketing_projects ADD COLUMN abbreviation text;
  END IF;
END $$;

-- Add industry field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_projects' AND column_name = 'industry'
  ) THEN
    ALTER TABLE marketing_projects ADD COLUMN industry text;
  END IF;
END $$;

-- Add other_industry field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_projects' AND column_name = 'other_industry'
  ) THEN
    ALTER TABLE marketing_projects ADD COLUMN other_industry text;
  END IF;
END $$;

-- Add is_ecommerce field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_projects' AND column_name = 'is_ecommerce'
  ) THEN
    ALTER TABLE marketing_projects ADD COLUMN is_ecommerce boolean DEFAULT false;
  END IF;
END $$;

-- Add channel_partner_id field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_projects' AND column_name = 'channel_partner_id'
  ) THEN
    ALTER TABLE marketing_projects ADD COLUMN channel_partner_id uuid REFERENCES channel_partners(id);
  END IF;
END $$;

-- Add parent_client_id field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_projects' AND column_name = 'parent_client_id'
  ) THEN
    ALTER TABLE marketing_projects ADD COLUMN parent_client_id text;
  END IF;
END $$;

-- Add parent_company_name field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_projects' AND column_name = 'parent_company_name'
  ) THEN
    ALTER TABLE marketing_projects ADD COLUMN parent_company_name text;
  END IF;
END $$;
