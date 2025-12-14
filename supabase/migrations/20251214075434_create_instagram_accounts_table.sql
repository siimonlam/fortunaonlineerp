/*
  # Create Instagram Accounts Table

  1. New Tables
    - `instagram_accounts`
      - `id` (uuid, primary key) - Internal database ID
      - `account_id` (text, unique, not null) - Instagram Business account unique ID from API (id/ig_id)
      - `username` (text, not null) - Instagram handle (e.g., @yourbrand)
      - `name` (text) - Display name on Instagram
      - `biography` (text) - Bio text
      - `profile_picture_url` (text) - URL of the profile picture
      - `website` (text) - Link in the bio
      - `followers_count` (integer, default 0) - Total number of followers
      - `follows_count` (integer, default 0) - Total number of accounts followed
      - `media_count` (integer, default 0) - Total number of media posts
      - `client_number` (text) - Reference to client in C0000 format
      - `last_updated` (timestamptz, default now()) - Last sync timestamp
      - `created_at` (timestamptz, default now()) - Record creation timestamp
  
  2. Security
    - Enable RLS on `instagram_accounts` table
    - Add policies for authenticated users to manage Instagram accounts
  
  3. Indexes
    - Index on `account_id` for API lookups
    - Index on `username` for searches
    - Index on `client_number` for client filtering
*/

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text UNIQUE NOT NULL,
  username text NOT NULL,
  name text DEFAULT '',
  biography text DEFAULT '',
  profile_picture_url text DEFAULT '',
  website text DEFAULT '',
  followers_count integer DEFAULT 0,
  follows_count integer DEFAULT 0,
  media_count integer DEFAULT 0,
  client_number text,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view Instagram accounts"
  ON instagram_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert Instagram accounts"
  ON instagram_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update Instagram accounts"
  ON instagram_accounts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete Instagram accounts"
  ON instagram_accounts FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_instagram_accounts_account_id ON instagram_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_username ON instagram_accounts(username);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_client_number ON instagram_accounts(client_number);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_last_updated ON instagram_accounts(last_updated DESC);
