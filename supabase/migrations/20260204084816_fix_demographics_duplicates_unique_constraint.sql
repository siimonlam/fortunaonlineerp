/*
  # Fix Demographics Duplicate Entries Issue

  1. Problem
    - The unique constraint includes 'country' column which is always NULL
    - SQL treats NULL != NULL, so duplicate entries are created on each sync
    - Account 1198243697495348 has 90 duplicate entries per demographic combination

  2. Changes
    - Drop existing unique constraint that includes country
    - Create new unique constraint WITHOUT country field
    - Remove all duplicate demographic entries (keep only the most recent one per unique combination)
    - Same fix for platform insights table

  3. Impact
    - Demographics tab will show correct totals after re-sync
    - Future syncs will properly update instead of creating duplicates
*/

-- First, let's clean up the duplicate demographics data
-- Keep only the most recent record for each unique combination
DELETE FROM meta_monthly_demographics a
USING meta_monthly_demographics b
WHERE 
  a.id < b.id
  AND a.account_id = b.account_id
  AND a.adset_id = b.adset_id
  AND a.month_year = b.month_year
  AND a.age_group = b.age_group
  AND a.gender = b.gender
  AND COALESCE(a.country, '') = COALESCE(b.country, '');

-- Drop the old unique constraint that includes country
ALTER TABLE meta_monthly_demographics 
DROP CONSTRAINT IF EXISTS unique_monthly_demographic;

-- Create new unique constraint WITHOUT country
-- Since country is not being populated, we should not include it in the constraint
ALTER TABLE meta_monthly_demographics
ADD CONSTRAINT unique_monthly_demographic_v2
UNIQUE (adset_id, month_year, age_group, gender);

-- Check and fix platform insights table too
-- First clean up duplicates
DELETE FROM meta_platform_insights a
USING meta_platform_insights b
WHERE 
  a.id < b.id
  AND a.account_id = b.account_id
  AND a.adset_id = b.adset_id
  AND a.month_year = b.month_year
  AND a.campaign_id = b.campaign_id
  AND a.publisher_platform = b.publisher_platform;

-- Drop old constraint if exists
ALTER TABLE meta_platform_insights 
DROP CONSTRAINT IF EXISTS meta_platform_insights_account_id_campaign_id_adset_id_m_key;

-- Recreate the correct unique constraint
ALTER TABLE meta_platform_insights
ADD CONSTRAINT unique_platform_insights
UNIQUE (account_id, campaign_id, adset_id, month_year, publisher_platform);
