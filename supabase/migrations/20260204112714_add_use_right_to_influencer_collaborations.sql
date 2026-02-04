/*
  # Add Use Right field to Influencer Collaborations

  1. Changes
    - Add `use_right` array column to `marketing_influencer_collaborations` table
    - Stores multiple usage rights selections (KOL IG, KOL TIKTOK, KOL Facebook, Brand Accounts)
*/

ALTER TABLE marketing_influencer_collaborations
ADD COLUMN IF NOT EXISTS use_right text[];
