/*
  # Add Objective-Specific Result Columns to Meta Ads Tables

  This migration adds dedicated columns for each campaign objective type to Meta Ads reporting tables.
  Instead of a single "results" column, we now track:
  - Sales (purchases, checkouts, carts)
  - Leads (lead conversions, contacts)
  - Traffic (link clicks, landing page views)
  - Engagement (post engagement, likes, video views)
  - Awareness (ad recall, reach)
  - App Installs (mobile app installs)

  ## Changes

  1. **meta_monthly_insights** - Add objective-specific columns
  2. **meta_monthly_demographics** - Add objective-specific columns
  3. **meta_platform_insights** - Add objective-specific columns
  4. **meta_ad_insights** - Add objective-specific columns

  ## Notes
  - Existing `results` and `result_type` columns are kept for backward compatibility
  - New columns default to 0
  - Each column follows the priority logic (first match wins, no summing)
*/

-- Add objective-specific result columns to meta_monthly_insights
ALTER TABLE meta_monthly_insights
  ADD COLUMN IF NOT EXISTS sales INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS traffic INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS awareness INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS app_installs INTEGER DEFAULT 0;

-- Add objective-specific result columns to meta_monthly_demographics
ALTER TABLE meta_monthly_demographics
  ADD COLUMN IF NOT EXISTS sales INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS traffic INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS awareness INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS app_installs INTEGER DEFAULT 0;

-- Add objective-specific result columns to meta_platform_insights
ALTER TABLE meta_platform_insights
  ADD COLUMN IF NOT EXISTS sales INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS traffic INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS awareness INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS app_installs INTEGER DEFAULT 0;

-- Add objective-specific result columns to meta_ad_insights
ALTER TABLE meta_ad_insights
  ADD COLUMN IF NOT EXISTS sales INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS traffic INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS awareness INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS app_installs INTEGER DEFAULT 0;