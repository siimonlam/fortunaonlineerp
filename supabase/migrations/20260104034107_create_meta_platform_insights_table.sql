/*
  # Create Meta Platform Insights Table

  1. New Tables
    - `meta_platform_insights`
      - Stores platform-level metrics (Facebook, Instagram, Messenger, Audience Network)
      - Tracks impressions, clicks, spend, results by platform
      - Monthly aggregation by platform

  2. Security
    - Enable RLS
    - Allow authenticated users to view, insert, and update platform insights
*/

CREATE TABLE IF NOT EXISTS meta_platform_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  campaign_id text,
  adset_id text,
  month_year date NOT NULL,
  publisher_platform text NOT NULL, -- facebook, instagram, messenger, audience_network

  -- Metrics
  impressions bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  spend numeric DEFAULT 0,
  results bigint DEFAULT 0,
  ctr numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  conversions bigint DEFAULT 0,

  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(account_id, campaign_id, adset_id, month_year, publisher_platform)
);

ALTER TABLE meta_platform_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view platform insights"
  ON meta_platform_insights FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert platform insights"
  ON meta_platform_insights FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update platform insights"
  ON meta_platform_insights FOR UPDATE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_meta_platform_insights_account_id
  ON meta_platform_insights(account_id);

CREATE INDEX IF NOT EXISTS idx_meta_platform_insights_month_year
  ON meta_platform_insights(month_year);

CREATE INDEX IF NOT EXISTS idx_meta_platform_insights_marketing_ref
  ON meta_platform_insights(marketing_reference);
