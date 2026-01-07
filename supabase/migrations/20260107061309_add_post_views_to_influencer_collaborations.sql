/*
  # Add post_views column to influencer collaborations

  1. Changes
    - Add `post_views` column to `marketing_influencer_collaborations` table
    - Column stores the view count for social media posts
    - Default value is 0 for existing records
*/

ALTER TABLE marketing_influencer_collaborations 
ADD COLUMN IF NOT EXISTS post_views integer DEFAULT 0;
