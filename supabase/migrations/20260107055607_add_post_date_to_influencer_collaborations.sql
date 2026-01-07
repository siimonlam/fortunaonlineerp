/*
  # Add Post Date Field to Influencer Collaborations

  1. Changes
    - Add `post_date` field to `marketing_influencer_collaborations` table
    - This field stores when the influencer actually published the post
    - Type: date (to match outreach_date field type)

  2. Purpose
    - Track when the post was published to calculate campaign timing
    - Support sorting and filtering by post date
    - Enable better performance tracking
*/

-- Add post_date column to marketing_influencer_collaborations
ALTER TABLE marketing_influencer_collaborations
ADD COLUMN IF NOT EXISTS post_date date;

-- Add index for post_date for better query performance
CREATE INDEX IF NOT EXISTS idx_influencer_collab_post_date
ON marketing_influencer_collaborations(post_date);