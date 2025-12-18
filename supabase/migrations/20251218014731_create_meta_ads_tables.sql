/*
  # Create Meta Ads Tables

  1. New Tables
    - `meta_ad_accounts` - Store Meta ad account information
    - `meta_campaigns` - Store ad campaigns
    - `meta_adsets` - Store ad sets
    - `meta_ads` - Store individual ads
    - `meta_ad_creatives` - Store ad creative content
    - `meta_ad_insights` - Store daily performance metrics
    - `meta_ad_insights_demographics` - Store demographic breakdowns
    - `marketing_meta_ad_accounts` - Junction table linking marketing projects to ad accounts

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access data
*/

-- Meta Ad Accounts Table
CREATE TABLE IF NOT EXISTS meta_ad_accounts (
  account_id text PRIMARY KEY,
  account_name text,
  currency text,
  timezone_name text,
  business_id text,
  business_name text,
  account_status integer,
  disable_reason text,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meta_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view meta ad accounts"
  ON meta_ad_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert meta ad accounts"
  ON meta_ad_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update meta ad accounts"
  ON meta_ad_accounts FOR UPDATE
  TO authenticated
  USING (true);

-- Meta Campaigns Table
CREATE TABLE IF NOT EXISTS meta_campaigns (
  campaign_id text PRIMARY KEY,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  name text,
  objective text,
  status text,
  daily_budget numeric,
  lifetime_budget numeric,
  budget_remaining numeric,
  start_time timestamptz,
  stop_time timestamptz,
  created_time timestamptz,
  updated_time timestamptz,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view meta campaigns"
  ON meta_campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert meta campaigns"
  ON meta_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update meta campaigns"
  ON meta_campaigns FOR UPDATE
  TO authenticated
  USING (true);

-- Meta Ad Sets Table
CREATE TABLE IF NOT EXISTS meta_adsets (
  adset_id text PRIMARY KEY,
  campaign_id text REFERENCES meta_campaigns(campaign_id) ON DELETE CASCADE,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  name text,
  status text,
  daily_budget numeric,
  lifetime_budget numeric,
  bid_amount numeric,
  billing_event text,
  optimization_goal text,
  targeting jsonb,
  start_time timestamptz,
  end_time timestamptz,
  created_time timestamptz,
  updated_time timestamptz,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meta_adsets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view meta adsets"
  ON meta_adsets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert meta adsets"
  ON meta_adsets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update meta adsets"
  ON meta_adsets FOR UPDATE
  TO authenticated
  USING (true);

-- Meta Ads Table
CREATE TABLE IF NOT EXISTS meta_ads (
  ad_id text PRIMARY KEY,
  adset_id text REFERENCES meta_adsets(adset_id) ON DELETE CASCADE,
  campaign_id text REFERENCES meta_campaigns(campaign_id) ON DELETE CASCADE,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  name text,
  status text,
  creative_id text,
  preview_shareable_link text,
  effective_status text,
  configured_status text,
  created_time timestamptz,
  updated_time timestamptz,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meta_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view meta ads"
  ON meta_ads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert meta ads"
  ON meta_ads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update meta ads"
  ON meta_ads FOR UPDATE
  TO authenticated
  USING (true);

-- Meta Ad Creatives Table
CREATE TABLE IF NOT EXISTS meta_ad_creatives (
  creative_id text PRIMARY KEY,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  name text,
  title text,
  body text,
  image_url text,
  video_id text,
  link_url text,
  call_to_action_type text,
  object_story_spec jsonb,
  thumbnail_url text,
  created_time timestamptz,
  updated_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meta_ad_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view meta ad creatives"
  ON meta_ad_creatives FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert meta ad creatives"
  ON meta_ad_creatives FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update meta ad creatives"
  ON meta_ad_creatives FOR UPDATE
  TO authenticated
  USING (true);

-- Meta Ad Insights Table (Daily Metrics)
CREATE TABLE IF NOT EXISTS meta_ad_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text REFERENCES meta_ads(ad_id) ON DELETE CASCADE,
  adset_id text REFERENCES meta_adsets(adset_id) ON DELETE CASCADE,
  campaign_id text REFERENCES meta_campaigns(campaign_id) ON DELETE CASCADE,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  date date NOT NULL,

  -- Delivery Metrics
  impressions bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  frequency numeric DEFAULT 0,

  -- Engagement Metrics
  clicks bigint DEFAULT 0,
  unique_clicks bigint DEFAULT 0,
  ctr numeric DEFAULT 0,
  unique_ctr numeric DEFAULT 0,
  inline_link_clicks bigint DEFAULT 0,
  inline_link_click_ctr numeric DEFAULT 0,

  -- Cost Metrics
  spend numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  cpp numeric DEFAULT 0,

  -- Video Metrics
  video_views bigint DEFAULT 0,
  video_avg_time_watched_actions numeric DEFAULT 0,
  video_p25_watched_actions bigint DEFAULT 0,
  video_p50_watched_actions bigint DEFAULT 0,
  video_p75_watched_actions bigint DEFAULT 0,
  video_p100_watched_actions bigint DEFAULT 0,

  -- Conversion Metrics
  conversions bigint DEFAULT 0,
  conversion_values numeric DEFAULT 0,
  cost_per_conversion numeric DEFAULT 0,
  actions jsonb,

  -- Additional Metrics
  social_spend numeric DEFAULT 0,
  website_ctr numeric DEFAULT 0,
  outbound_clicks bigint DEFAULT 0,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,

  -- Link to system
  client_number text,
  marketing_reference text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(ad_id, date)
);

ALTER TABLE meta_ad_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view meta ad insights"
  ON meta_ad_insights FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert meta ad insights"
  ON meta_ad_insights FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update meta ad insights"
  ON meta_ad_insights FOR UPDATE
  TO authenticated
  USING (true);

-- Meta Ad Insights Demographics Table
CREATE TABLE IF NOT EXISTS meta_ad_insights_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text REFERENCES meta_ads(ad_id) ON DELETE CASCADE,
  date date NOT NULL,
  age text,
  gender text,
  country text,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  spend numeric DEFAULT 0,
  conversions bigint DEFAULT 0,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(ad_id, date, age, gender, country)
);

ALTER TABLE meta_ad_insights_demographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view meta ad insights demographics"
  ON meta_ad_insights_demographics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert meta ad insights demographics"
  ON meta_ad_insights_demographics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update meta ad insights demographics"
  ON meta_ad_insights_demographics FOR UPDATE
  TO authenticated
  USING (true);

-- Marketing Meta Ad Accounts Junction Table
CREATE TABLE IF NOT EXISTS marketing_meta_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid REFERENCES marketing_projects(id) ON DELETE CASCADE,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(marketing_project_id, account_id)
);

ALTER TABLE marketing_meta_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view marketing meta ad accounts"
  ON marketing_meta_ad_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert marketing meta ad accounts"
  ON marketing_meta_ad_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update marketing meta ad accounts"
  ON marketing_meta_ad_accounts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete marketing meta ad accounts"
  ON marketing_meta_ad_accounts FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_account_id ON meta_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign_id ON meta_adsets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_account_id ON meta_adsets(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset_id ON meta_ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign_id ON meta_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_account_id ON meta_ads(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_creatives_account_id ON meta_ad_creatives(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_ad_id ON meta_ad_insights(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_date ON meta_ad_insights(date);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_demographics_ad_id ON meta_ad_insights_demographics(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_demographics_date ON meta_ad_insights_demographics(date);
CREATE INDEX IF NOT EXISTS idx_marketing_meta_ad_accounts_marketing_project_id ON marketing_meta_ad_accounts(marketing_project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_meta_ad_accounts_account_id ON marketing_meta_ad_accounts(account_id);
