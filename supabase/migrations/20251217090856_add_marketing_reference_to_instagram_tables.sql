/*
  # Add Marketing Reference to Instagram Tables

  1. Changes
    - Add `marketing_reference` column to instagram_accounts, instagram_posts, and instagram_post_metrics
    - Update client_number to use client number (C0xxx format) instead of marketing project reference (MP0xxx)
    - Move existing client_number values (MP0xxx) to marketing_reference
    - Update all triggers to populate both fields correctly

  2. Purpose
    - Separate client identification (C0xxx) from marketing project identification (MP0xxx)
    - Enable filtering by both client and specific marketing project
*/

-- Add marketing_reference column to instagram_accounts
ALTER TABLE instagram_accounts
ADD COLUMN IF NOT EXISTS marketing_reference text;

-- Add marketing_reference column to instagram_posts
ALTER TABLE instagram_posts
ADD COLUMN IF NOT EXISTS marketing_reference text;

-- Add marketing_reference column to instagram_post_metrics
ALTER TABLE instagram_post_metrics
ADD COLUMN IF NOT EXISTS marketing_reference text;

-- Migrate existing data: Move MP0xxx from client_number to marketing_reference
UPDATE instagram_accounts
SET 
  marketing_reference = client_number,
  client_number = NULL
WHERE client_number LIKE 'MP%';

UPDATE instagram_posts
SET 
  marketing_reference = client_number,
  client_number = NULL
WHERE client_number LIKE 'MP%';

UPDATE instagram_post_metrics
SET 
  marketing_reference = client_number,
  client_number = NULL
WHERE client_number LIKE 'MP%';

-- Update function to sync both client_number and marketing_reference to instagram_accounts
CREATE OR REPLACE FUNCTION sync_instagram_account_client_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Get both project_reference and client_number from the marketing project
  UPDATE instagram_accounts
  SET 
    marketing_reference = (
      SELECT project_reference
      FROM marketing_projects
      WHERE id = NEW.marketing_project_id
    ),
    client_number = (
      SELECT client_number
      FROM marketing_projects
      WHERE id = NEW.marketing_project_id
    )
  WHERE account_id = NEW.account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function for instagram_posts to get both fields from account
CREATE OR REPLACE FUNCTION sync_instagram_post_client_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT 
    client_number,
    marketing_reference
  INTO 
    NEW.client_number,
    NEW.marketing_reference
  FROM instagram_accounts
  WHERE account_id = NEW.account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update function for instagram_post_metrics to get both fields from account
CREATE OR REPLACE FUNCTION sync_instagram_metric_client_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT 
    client_number,
    marketing_reference
  INTO 
    NEW.client_number,
    NEW.marketing_reference
  FROM instagram_accounts
  WHERE account_id = NEW.account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill instagram_accounts with proper client_number and marketing_reference
UPDATE instagram_accounts ia
SET 
  client_number = mp.client_number,
  marketing_reference = mp.project_reference
FROM marketing_project_instagram_accounts mpia
JOIN marketing_projects mp ON mpia.marketing_project_id = mp.id
WHERE ia.account_id = mpia.account_id;

-- Backfill instagram_posts
UPDATE instagram_posts ip
SET 
  client_number = ia.client_number,
  marketing_reference = ia.marketing_reference
FROM instagram_accounts ia
WHERE ip.account_id = ia.account_id;

-- Backfill instagram_post_metrics (if any exist)
UPDATE instagram_post_metrics ipm
SET 
  client_number = ia.client_number,
  marketing_reference = ia.marketing_reference
FROM instagram_accounts ia
WHERE ipm.account_id = ia.account_id;