/*
  # Add Social Media Links to Influencer Collaborations

  1. Changes
    - Add `instagram_link` (text) - Instagram profile URL
    - Add `tiktok_link` (text) - TikTok profile URL
    - Add `facebook_link` (text) - Facebook profile URL
    - Add `youtube_link` (text) - YouTube channel URL
    - Add `phone_number` (text) - Contact phone number
    - Add `script` (text) - Collaboration script or talking points
    - Add `platforms` (text[]) - Array of platforms (for multi-platform influencers)
    - Add `post_views` (integer) - Number of post views

  2. Purpose
    - Allow tracking multiple social media profiles for each influencer
    - Enable comprehensive platform presence tracking
    - Store collaboration scripts and multiple platform selection
*/

-- Add social media link columns
ALTER TABLE marketing_influencer_collaborations
  ADD COLUMN IF NOT EXISTS instagram_link text,
  ADD COLUMN IF NOT EXISTS tiktok_link text,
  ADD COLUMN IF NOT EXISTS facebook_link text,
  ADD COLUMN IF NOT EXISTS youtube_link text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS script text,
  ADD COLUMN IF NOT EXISTS platforms text[],
  ADD COLUMN IF NOT EXISTS post_views integer DEFAULT 0;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_influencer_collab_instagram ON marketing_influencer_collaborations(instagram_link) WHERE instagram_link IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencer_collab_tiktok ON marketing_influencer_collaborations(tiktok_link) WHERE tiktok_link IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencer_collab_facebook ON marketing_influencer_collaborations(facebook_link) WHERE facebook_link IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencer_collab_youtube ON marketing_influencer_collaborations(youtube_link) WHERE youtube_link IS NOT NULL;
