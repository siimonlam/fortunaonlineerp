/*
  # Update Influencer Collaborations - Markets and Currency

  1. Changes
    - Add `primary_markets` (text[]) - Array of markets/countries (multi-select)
    - Add `compensation_currency` (text) - Currency code for compensation (USD, GBP, HKD, etc.)
    - Add `compensation_amount` (numeric) - Numeric amount for compensation

  2. Purpose
    - Allow selecting multiple primary markets per influencer
    - Enable currency-specific compensation tracking
    - Separate compensation amount from text description
*/

-- Add new columns for multi-market support and currency
ALTER TABLE marketing_influencer_collaborations
  ADD COLUMN IF NOT EXISTS primary_markets text[],
  ADD COLUMN IF NOT EXISTS compensation_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS compensation_amount numeric(12, 2);

-- Create index for markets array
CREATE INDEX IF NOT EXISTS idx_influencer_collab_markets ON marketing_influencer_collaborations USING GIN(primary_markets);
