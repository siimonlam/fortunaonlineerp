/*
  # Create Instagram Posts Table

  1. New Tables
    - `instagram_posts`
      - `id` (uuid, primary key) - Internal database ID
      - `media_id` (text, unique, not null) - Unique ID for the specific post from API
      - `date` (timestamptz, not null) - Publication date & time (ISO 8601 format)
      - `caption` (text) - The text/description of the post
      - `media_type` (text, not null) - Type: IMAGE, VIDEO, CAROUSEL_ALBUM
      - `media_url` (text) - Direct link to the image/video file
      - `permalink` (text) - Permanent link to the post on Instagram
      - `thumbnail_url` (text) - Cover image (for videos/reels)
      - `likes_count` (integer, default 0) - Visible like count (snapshot)
      - `comments_count` (integer, default 0) - Visible comment count (snapshot)
      - `account_id` (text, not null) - References instagram_accounts.account_id
      - `client_number` (text) - Client reference in C0000 format
      - `created_at` (timestamptz, default now()) - Record creation timestamp
      - `updated_at` (timestamptz, default now()) - Last update timestamp
  
  2. Security
    - Enable RLS on `instagram_posts` table
    - Add policies for authenticated users to manage Instagram posts
  
  3. Indexes
    - Index on `media_id` for API lookups
    - Index on `account_id` for filtering posts by account
    - Index on `client_number` for client filtering
    - Index on `date` for chronological queries
    - Index on `media_type` for filtering by content type

  4. Foreign Keys
    - Foreign key relationship to `instagram_accounts` table
*/

CREATE TABLE IF NOT EXISTS instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id text UNIQUE NOT NULL,
  date timestamptz NOT NULL,
  caption text DEFAULT '',
  media_type text NOT NULL,
  media_url text DEFAULT '',
  permalink text DEFAULT '',
  thumbnail_url text DEFAULT '',
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  account_id text NOT NULL,
  client_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_instagram_account
    FOREIGN KEY (account_id)
    REFERENCES instagram_accounts(account_id)
    ON DELETE CASCADE
);

ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view Instagram posts"
  ON instagram_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert Instagram posts"
  ON instagram_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update Instagram posts"
  ON instagram_posts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete Instagram posts"
  ON instagram_posts FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_media_id ON instagram_posts(media_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_account_id ON instagram_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_client_number ON instagram_posts(client_number);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_date ON instagram_posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_media_type ON instagram_posts(media_type);

CREATE OR REPLACE FUNCTION update_instagram_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_instagram_posts_updated_at
  BEFORE UPDATE ON instagram_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_instagram_posts_updated_at();
