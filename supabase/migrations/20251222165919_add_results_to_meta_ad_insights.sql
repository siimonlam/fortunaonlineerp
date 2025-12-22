/*
  # Add Results Column to Meta Ad Insights Tables

  1. Changes
    - Add `results` column to `meta_ad_insights` table to track conversion results
    - Add `results` column to `meta_ad_insights_demographics` table
    - Add `result_type` to track what kind of result it is (e.g., 'purchase', 'lead', 'add_to_cart')

  2. Notes
    - Results represent the outcome actions taken (conversions, leads, purchases, etc.)
    - This is separate from conversions as it captures different types of actions
*/

-- Add results column to meta_ad_insights
ALTER TABLE meta_ad_insights
ADD COLUMN IF NOT EXISTS results bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS result_type text;

-- Add results column to meta_ad_insights_demographics
ALTER TABLE meta_ad_insights_demographics
ADD COLUMN IF NOT EXISTS results bigint DEFAULT 0;
