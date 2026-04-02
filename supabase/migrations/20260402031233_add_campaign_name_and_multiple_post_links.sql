/*
  # Add Campaign Name and Multiple Post Links to Influencer Collaborations

  1. Changes
    - Add `campaign_name` (text) - Name/title of the collaboration campaign
    - Add `post_links` (jsonb) - Array of post link objects with URL and optional description
    - Migrate existing `post_link` data to new `post_links` array structure

  2. Purpose
    - Enable tracking of campaign names for better organization
    - Allow multiple post links per collaboration (e.g., multiple posts for same campaign)
    - Maintain backward compatibility by preserving existing post_link data

  3. Data Structure
    - post_links will be stored as: [{"url": "https://...", "description": "Post 1"}, ...]
*/

-- Add campaign_name column
ALTER TABLE marketing_influencer_collaborations
  ADD COLUMN IF NOT EXISTS campaign_name text;

-- Add post_links as jsonb array
ALTER TABLE marketing_influencer_collaborations
  ADD COLUMN IF NOT EXISTS post_links jsonb DEFAULT '[]'::jsonb;

-- Migrate existing post_link data to post_links array
UPDATE marketing_influencer_collaborations
SET post_links = jsonb_build_array(
  jsonb_build_object('url', post_link, 'description', '')
)
WHERE post_link IS NOT NULL AND post_link != '' AND (post_links IS NULL OR post_links = '[]'::jsonb);

-- Create index for campaign_name for better search performance
CREATE INDEX IF NOT EXISTS idx_influencer_collab_campaign_name ON marketing_influencer_collaborations(campaign_name) WHERE campaign_name IS NOT NULL;
