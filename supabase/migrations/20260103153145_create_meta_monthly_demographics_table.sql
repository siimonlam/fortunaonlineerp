/*
  # Create Meta Monthly Demographics Table

  1. New Tables
    - meta_monthly_demographics
      - id (uuid, primary key)
      - account_id (text)
      - campaign_id (text, nullable)
      - adset_id (text)
      - month_year (text)
      - age_group (text)
      - gender (text)
      - country (text, nullable)
      - spend (numeric)
      - impressions (integer)
      - clicks (integer)
      - reach (integer)
      - conversions (integer)
      - results (integer)
      - client_number (text, nullable)
      - marketing_reference (text, nullable)
      - created_at (timestamptz)
      - updated_at (timestamptz)

  2. Indexes
    - Composite unique index on adset_id, month_year, age_group, gender, country
    - Index on account_id for faster filtering
    - Index on month_year for date range queries

  3. Security
    - Enable RLS on meta_monthly_demographics table
    - Add policy for authenticated users to read demographic data
*/

CREATE TABLE IF NOT EXISTS meta_monthly_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  campaign_id text,
  adset_id text NOT NULL,
  month_year text NOT NULL,
  age_group text NOT NULL,
  gender text NOT NULL,
  country text,
  spend numeric DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  reach integer DEFAULT 0,
  conversions integer DEFAULT 0,
  results integer DEFAULT 0,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_demographic_segment 
    UNIQUE (adset_id, month_year, age_group, gender, country)
);

CREATE INDEX IF NOT EXISTS idx_demographics_account_id 
  ON meta_monthly_demographics(account_id);

CREATE INDEX IF NOT EXISTS idx_demographics_month_year 
  ON meta_monthly_demographics(month_year);

CREATE INDEX IF NOT EXISTS idx_demographics_client_number 
  ON meta_monthly_demographics(client_number);

CREATE INDEX IF NOT EXISTS idx_demographics_marketing_reference 
  ON meta_monthly_demographics(marketing_reference);

ALTER TABLE meta_monthly_demographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read demographics"
  ON meta_monthly_demographics
  FOR SELECT
  TO authenticated
  USING (true);