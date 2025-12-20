/*
  # Create Facebook Page Insights Tables

  1. New Tables
    
    **facebook_page_insights**
    - Daily page-level metrics for Facebook pages
    - Tracks reach, engagement, followers growth, etc.
    
    **facebook_page_demographics**
    - Demographic breakdown by age, gender, location, device
    - Snapshot data for a specific date
    
  2. Updated Tables
    
    **facebook_accounts**
    - Add fields for current page totals (likes, reach, engagement rate)
    
  3. Available Metrics via Facebook Graph API
    
    A. Total Page Likes - page_fans
    B. Net Growth - page_fan_adds_unique - page_fan_removes_unique
    C. Organic Reach - page_impressions_organic
    D. Paid Reach - page_impressions_paid
    E. Total Reach - page_impressions_unique
    F. Engagement Rate - calculated (engaged_users / reach)
    G. Total Engagement - page_post_engagements
    H. Demographics - page_fans_gender_age, page_fans_city, page_fans_country
    I. Device - page_views_logged_in_unique (by device)
    
  4. Security
    - Enable RLS on all tables
    - Allow authenticated users to read insights
*/

-- Add new fields to facebook_accounts for current totals
ALTER TABLE facebook_accounts
ADD COLUMN IF NOT EXISTS total_page_likes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reach_28d integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_engagement_28d integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_growth_7d integer DEFAULT 0;

-- Create facebook_page_insights table for daily metrics
CREATE TABLE IF NOT EXISTS facebook_page_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text NOT NULL,
  account_id text NOT NULL,
  client_number text,
  marketing_reference text,
  date date NOT NULL,
  
  -- Follower metrics
  page_fans integer DEFAULT 0,
  page_fan_adds integer DEFAULT 0,
  page_fan_removes integer DEFAULT 0,
  net_growth integer DEFAULT 0,
  
  -- Reach metrics
  page_impressions integer DEFAULT 0,
  page_impressions_unique integer DEFAULT 0,
  page_impressions_organic integer DEFAULT 0,
  page_impressions_paid integer DEFAULT 0,
  
  -- Engagement metrics
  page_post_engagements integer DEFAULT 0,
  page_engaged_users integer DEFAULT 0,
  engagement_rate numeric(5,2) DEFAULT 0,
  
  -- Post activity
  page_posts_impressions integer DEFAULT 0,
  page_posts_impressions_unique integer DEFAULT 0,
  
  -- Video metrics
  page_video_views integer DEFAULT 0,
  page_video_views_unique integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(page_id, date)
);

-- Create facebook_page_demographics table
CREATE TABLE IF NOT EXISTS facebook_page_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text NOT NULL,
  account_id text NOT NULL,
  client_number text,
  marketing_reference text,
  date date NOT NULL,
  
  -- Age and Gender breakdown (stored as JSONB)
  -- Format: {"F.13-17": 120, "M.18-24": 450, ...}
  age_gender_breakdown jsonb DEFAULT '{}'::jsonb,
  
  -- Location breakdown (stored as JSONB)
  -- Format: {"Hong Kong": 1200, "United States": 450, ...}
  country_breakdown jsonb DEFAULT '{}'::jsonb,
  city_breakdown jsonb DEFAULT '{}'::jsonb,
  
  -- Device breakdown (stored as JSONB)
  -- Format: {"mobile": 800, "desktop": 400, "tablet": 50}
  device_breakdown jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(page_id, date)
);

-- Enable RLS
ALTER TABLE facebook_page_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_page_demographics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for facebook_page_insights
CREATE POLICY "Authenticated users can view page insights"
  ON facebook_page_insights
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert page insights"
  ON facebook_page_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update page insights"
  ON facebook_page_insights
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for facebook_page_demographics
CREATE POLICY "Authenticated users can view demographics"
  ON facebook_page_demographics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert demographics"
  ON facebook_page_demographics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update demographics"
  ON facebook_page_demographics
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_facebook_page_insights_page_id ON facebook_page_insights(page_id);
CREATE INDEX idx_facebook_page_insights_date ON facebook_page_insights(date DESC);
CREATE INDEX idx_facebook_page_insights_client ON facebook_page_insights(client_number);
CREATE INDEX idx_facebook_page_insights_marketing_ref ON facebook_page_insights(marketing_reference);

CREATE INDEX idx_facebook_demographics_page_id ON facebook_page_demographics(page_id);
CREATE INDEX idx_facebook_demographics_date ON facebook_page_demographics(date DESC);
CREATE INDEX idx_facebook_demographics_client ON facebook_page_demographics(client_number);
CREATE INDEX idx_facebook_demographics_marketing_ref ON facebook_page_demographics(marketing_reference);
