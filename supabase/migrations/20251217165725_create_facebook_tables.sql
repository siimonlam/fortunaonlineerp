/*
  # Create Facebook Integration Tables

  1. New Tables
    - `facebook_accounts`
      - `id` (uuid, primary key)
      - `page_id` (text, unique) - Facebook Page ID
      - `name` (text) - Page name
      - `username` (text) - Page username
      - `access_token` (text) - Page access token (encrypted)
      - `followers_count` (integer) - Number of followers
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `client_number` (text) - Reference to client

    - `facebook_posts`
      - `id` (uuid, primary key)
      - `post_id` (text, unique) - Facebook post ID
      - `page_id` (text) - Reference to Facebook page
      - `date` (timestamptz) - Post timestamp
      - `message` (text) - Post caption/message
      - `type` (text) - Post type (photo, video, link, status)
      - `full_picture` (text) - Image/video URL
      - `permalink_url` (text) - Link to post
      - `likes_count` (integer)
      - `comments_count` (integer)
      - `shares_count` (integer)
      - `account_id` (text) - Facebook page ID
      - `client_number` (text) - Reference to client
      - `marketing_reference` (text) - Reference to marketing project
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `facebook_post_metrics`
      - `id` (uuid, primary key)
      - `post_id` (text) - Facebook post ID
      - `account_id` (text) - Facebook page ID
      - `client_number` (text) - Reference to client
      - `marketing_reference` (text) - Reference to marketing project
      - `date` (timestamptz) - Metrics collection date
      - `impressions` (integer)
      - `reach` (integer)
      - `engagement` (integer)
      - `reactions` (integer)
      - `comments` (integer)
      - `shares` (integer)
      - `video_views` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Index on page_id for facebook_accounts
    - Index on post_id for facebook_posts
    - Index on client_number and marketing_reference for filtering
    - Index on account_id for lookups

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to view and manage
*/

-- Create facebook_accounts table
CREATE TABLE IF NOT EXISTS facebook_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  username text DEFAULT '',
  access_token text DEFAULT '',
  followers_count integer DEFAULT 0,
  client_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create facebook_posts table
CREATE TABLE IF NOT EXISTS facebook_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text UNIQUE NOT NULL,
  page_id text NOT NULL,
  date timestamptz NOT NULL,
  message text DEFAULT '',
  type text DEFAULT '',
  full_picture text DEFAULT '',
  permalink_url text DEFAULT '',
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  account_id text NOT NULL,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create facebook_post_metrics table
CREATE TABLE IF NOT EXISTS facebook_post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL,
  account_id text NOT NULL,
  client_number text,
  marketing_reference text,
  date timestamptz NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  engagement integer DEFAULT 0,
  reactions integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  video_views integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(post_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_facebook_accounts_page_id ON facebook_accounts(page_id);
CREATE INDEX IF NOT EXISTS idx_facebook_accounts_client_number ON facebook_accounts(client_number);

CREATE INDEX IF NOT EXISTS idx_facebook_posts_post_id ON facebook_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_account_id ON facebook_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_client_number ON facebook_posts(client_number);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_marketing_reference ON facebook_posts(marketing_reference);

CREATE INDEX IF NOT EXISTS idx_facebook_post_metrics_post_id ON facebook_post_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_facebook_post_metrics_account_id ON facebook_post_metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_facebook_post_metrics_client_number ON facebook_post_metrics(client_number);
CREATE INDEX IF NOT EXISTS idx_facebook_post_metrics_marketing_reference ON facebook_post_metrics(marketing_reference);

-- Enable RLS
ALTER TABLE facebook_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_post_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for facebook_accounts
CREATE POLICY "All authenticated users can view facebook accounts"
  ON facebook_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert facebook accounts"
  ON facebook_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update facebook accounts"
  ON facebook_accounts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can delete facebook accounts"
  ON facebook_accounts FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for facebook_posts
CREATE POLICY "All authenticated users can view facebook posts"
  ON facebook_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert facebook posts"
  ON facebook_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update facebook posts"
  ON facebook_posts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can delete facebook posts"
  ON facebook_posts FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for facebook_post_metrics
CREATE POLICY "All authenticated users can view facebook post metrics"
  ON facebook_post_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert facebook post metrics"
  ON facebook_post_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update facebook post metrics"
  ON facebook_post_metrics FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can delete facebook post metrics"
  ON facebook_post_metrics FOR DELETE
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_post_metrics;