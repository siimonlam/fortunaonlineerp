/*
  # Create Instagram Post Metrics Table

  1. New Tables
    - `instagram_post_metrics`
      - `id` (uuid, primary key) - Internal database ID
      - `media_id` (text, not null) - References instagram_posts.media_id
      - `account_id` (text, not null) - References instagram_accounts.account_id
      - `client_number` (text) - Client reference in C0000 format
      - `date` (timestamptz, not null) - Date when metrics were captured
      - `impressions` (integer, default 0) - Total number of times the post has been seen
      - `reach` (integer, default 0) - Total number of unique accounts that saw the post
      - `engagement` (integer, default 0) - Sum of Likes + Comments + Saves
      - `saved` (integer, default 0) - Number of times users "saved" the post
      - `video_views` (integer, default 0) - Number of times video was played (3s+)
      - `shares` (integer, default 0) - Number of times the reel was shared
      - `created_at` (timestamptz, default now()) - Record creation timestamp
      - `updated_at` (timestamptz, default now()) - Last update timestamp
  
  2. Security
    - Enable RLS on `instagram_post_metrics` table
    - Add policies for authenticated users to manage metrics
  
  3. Indexes
    - Index on `media_id` for filtering by post
    - Index on `account_id` for filtering by account
    - Index on `client_number` for client filtering
    - Index on `date` for time-series queries
    - Composite unique index on `media_id` + `date` to prevent duplicate metrics for same post/day

  4. Foreign Keys
    - Foreign key relationship to `instagram_posts` table
    - Foreign key relationship to `instagram_accounts` table
*/

CREATE TABLE IF NOT EXISTS instagram_post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id text NOT NULL,
  account_id text NOT NULL,
  client_number text,
  date timestamptz NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  engagement integer DEFAULT 0,
  saved integer DEFAULT 0,
  video_views integer DEFAULT 0,
  shares integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_instagram_post
    FOREIGN KEY (media_id)
    REFERENCES instagram_posts(media_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_instagram_account_metrics
    FOREIGN KEY (account_id)
    REFERENCES instagram_accounts(account_id)
    ON DELETE CASCADE,
  CONSTRAINT unique_media_date UNIQUE (media_id, date)
);

ALTER TABLE instagram_post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view Instagram post metrics"
  ON instagram_post_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert Instagram post metrics"
  ON instagram_post_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update Instagram post metrics"
  ON instagram_post_metrics FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete Instagram post metrics"
  ON instagram_post_metrics FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_instagram_post_metrics_media_id ON instagram_post_metrics(media_id);
CREATE INDEX IF NOT EXISTS idx_instagram_post_metrics_account_id ON instagram_post_metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_instagram_post_metrics_client_number ON instagram_post_metrics(client_number);
CREATE INDEX IF NOT EXISTS idx_instagram_post_metrics_date ON instagram_post_metrics(date DESC);

CREATE OR REPLACE FUNCTION update_instagram_post_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_instagram_post_metrics_updated_at
  BEFORE UPDATE ON instagram_post_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_instagram_post_metrics_updated_at();
