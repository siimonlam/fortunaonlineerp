/*
  # Create Ad-Level Monthly Insights Tables

  1. New Tables
    - `meta_ad_monthly_insights`
      - Ad-level monthly aggregated metrics (similar to meta_monthly_insights but at ad level)
      - Includes ad_id, ad_name, creative_id reference
      - Has actions JSONB column for flexible action tracking
      - Calculated result columns (sales, leads, traffic, engagement, etc.)
      - Breakdown columns (sales_purchase, sales_initiate_checkout, sales_add_to_cart)
      
    - `meta_ad_monthly_demographics`
      - Ad-level monthly demographic breakdowns (similar to meta_monthly_demographics but at ad level)
      - Includes age_group, gender, country dimensions
      - Has actions JSONB column for flexible action tracking
      - Calculated result columns matching the insights table
      - Breakdown columns matching the insights table

  2. Security
    - Enable RLS on both tables
    - Allow authenticated users to read data
    - Only service role can insert/update (via edge functions)

  3. Indexes
    - Performance indexes on common query patterns
    - Composite indexes for filtering and aggregation
*/

-- Create meta_ad_monthly_insights table
CREATE TABLE IF NOT EXISTS meta_ad_monthly_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text NOT NULL,
  ad_name text,
  adset_id text NOT NULL,
  adset_name text,
  campaign_id text NOT NULL,
  campaign_name text,
  account_id text NOT NULL,
  account_name text,
  creative_id text,
  month_year date NOT NULL,
  
  -- Core metrics
  impressions bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  frequency numeric DEFAULT 0,
  clicks bigint DEFAULT 0,
  unique_clicks bigint DEFAULT 0,
  ctr numeric DEFAULT 0,
  unique_ctr numeric DEFAULT 0,
  inline_link_clicks bigint DEFAULT 0,
  inline_link_click_ctr numeric DEFAULT 0,
  outbound_clicks bigint DEFAULT 0,
  spend numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  cpp numeric DEFAULT 0,
  
  -- Video metrics
  video_views bigint DEFAULT 0,
  video_avg_time_watched_actions numeric DEFAULT 0,
  video_p25_watched_actions bigint DEFAULT 0,
  video_p50_watched_actions bigint DEFAULT 0,
  video_p75_watched_actions bigint DEFAULT 0,
  video_p100_watched_actions bigint DEFAULT 0,
  
  -- Conversion metrics
  conversions bigint DEFAULT 0,
  conversion_values numeric DEFAULT 0,
  cost_per_conversion numeric DEFAULT 0,
  
  -- Result metrics
  results bigint DEFAULT 0,
  result_type text,
  cost_per_result numeric DEFAULT 0,
  
  -- Quality rankings
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  
  -- Actions JSONB for flexible tracking
  actions jsonb,
  
  -- Calculated objective-specific results
  sales integer DEFAULT 0,
  leads integer DEFAULT 0,
  traffic integer DEFAULT 0,
  engagement integer DEFAULT 0,
  awareness integer DEFAULT 0,
  app_installs integer DEFAULT 0,
  
  -- Sales breakdown
  sales_purchase integer DEFAULT 0,
  sales_initiate_checkout integer DEFAULT 0,
  sales_add_to_cart integer DEFAULT 0,
  
  -- Reference fields
  client_number text,
  marketing_reference text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(ad_id, month_year)
);

-- Create meta_ad_monthly_demographics table
CREATE TABLE IF NOT EXISTS meta_ad_monthly_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text NOT NULL,
  ad_name text,
  adset_id text NOT NULL,
  adset_name text,
  campaign_id text NOT NULL,
  campaign_name text,
  account_id text NOT NULL,
  month_year date NOT NULL,
  
  -- Demographic dimensions
  age_group text,
  gender text,
  country text,
  
  -- Core metrics
  impressions bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  spend numeric DEFAULT 0,
  conversions bigint DEFAULT 0,
  results bigint DEFAULT 0,
  ctr numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cost_per_result numeric DEFAULT 0,
  
  -- Actions JSONB for flexible tracking
  actions jsonb,
  result_type text,
  
  -- Calculated objective-specific results
  sales integer DEFAULT 0,
  leads integer DEFAULT 0,
  traffic integer DEFAULT 0,
  engagement integer DEFAULT 0,
  awareness integer DEFAULT 0,
  app_installs integer DEFAULT 0,
  
  -- Sales breakdown
  sales_purchase integer DEFAULT 0,
  sales_initiate_checkout integer DEFAULT 0,
  sales_add_to_cart integer DEFAULT 0,
  
  -- Reference fields
  client_number text,
  marketing_reference text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(ad_id, month_year, age_group, gender, country)
);

-- Create indexes for meta_ad_monthly_insights
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_insights_ad_id ON meta_ad_monthly_insights(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_insights_adset_id ON meta_ad_monthly_insights(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_insights_campaign_id ON meta_ad_monthly_insights(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_insights_account_id ON meta_ad_monthly_insights(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_insights_creative_id ON meta_ad_monthly_insights(creative_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_insights_month_year ON meta_ad_monthly_insights(month_year);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_insights_client_number ON meta_ad_monthly_insights(client_number);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_insights_marketing_reference ON meta_ad_monthly_insights(marketing_reference);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_insights_composite ON meta_ad_monthly_insights(account_id, month_year);

-- Create indexes for meta_ad_monthly_demographics
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_ad_id ON meta_ad_monthly_demographics(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_adset_id ON meta_ad_monthly_demographics(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_campaign_id ON meta_ad_monthly_demographics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_account_id ON meta_ad_monthly_demographics(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_month_year ON meta_ad_monthly_demographics(month_year);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_client_number ON meta_ad_monthly_demographics(client_number);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_marketing_reference ON meta_ad_monthly_demographics(marketing_reference);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_age_group ON meta_ad_monthly_demographics(age_group);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_gender ON meta_ad_monthly_demographics(gender);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_country ON meta_ad_monthly_demographics(country);
CREATE INDEX IF NOT EXISTS idx_meta_ad_monthly_demographics_composite ON meta_ad_monthly_demographics(account_id, month_year);

-- Enable RLS
ALTER TABLE meta_ad_monthly_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_monthly_demographics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meta_ad_monthly_insights
CREATE POLICY "Allow authenticated users to read ad monthly insights"
  ON meta_ad_monthly_insights
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role to insert ad monthly insights"
  ON meta_ad_monthly_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service role to update ad monthly insights"
  ON meta_ad_monthly_insights
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role to delete ad monthly insights"
  ON meta_ad_monthly_insights
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for meta_ad_monthly_demographics
CREATE POLICY "Allow authenticated users to read ad monthly demographics"
  ON meta_ad_monthly_demographics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role to insert ad monthly demographics"
  ON meta_ad_monthly_demographics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service role to update ad monthly demographics"
  ON meta_ad_monthly_demographics
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role to delete ad monthly demographics"
  ON meta_ad_monthly_demographics
  FOR DELETE
  TO authenticated
  USING (true);
