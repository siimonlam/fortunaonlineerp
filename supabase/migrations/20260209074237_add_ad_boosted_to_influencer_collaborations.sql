/*
  # Add Ad Boosted Field to Influencer Collaborations

  1. Changes
    - Add `ad_boosted` boolean field to `marketing_influencer_collaborations` table
    - Default value: false
    - Allows tracking whether influencer posts are being boosted with paid ads

  2. Purpose
    - Enable tracking of which influencer collaborations have their posts boosted through paid advertising
    - Help teams identify which posts are getting additional promotion through Meta Ads or other platforms
*/

-- Add ad_boosted field to marketing_influencer_collaborations table
ALTER TABLE marketing_influencer_collaborations
ADD COLUMN IF NOT EXISTS ad_boosted boolean DEFAULT false;

-- Add index for filtering by ad_boosted status
CREATE INDEX IF NOT EXISTS idx_influencer_collab_ad_boosted ON marketing_influencer_collaborations(ad_boosted);
