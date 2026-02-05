/*
  # Add adset_name to meta_monthly_demographics

  1. Changes
    - Add `adset_name` column to `meta_monthly_demographics` table
    - This allows us to query and group ad set data by name directly from demographics
    
  2. Notes
    - Existing records will have NULL adset_name, which will be populated on next sync
*/

-- Add adset_name column
ALTER TABLE meta_monthly_demographics 
ADD COLUMN IF NOT EXISTS adset_name TEXT;

-- Create index for faster queries by adset_name
CREATE INDEX IF NOT EXISTS idx_meta_monthly_demographics_adset_name 
ON meta_monthly_demographics(adset_name);