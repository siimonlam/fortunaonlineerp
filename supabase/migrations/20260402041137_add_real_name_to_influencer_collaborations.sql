/*
  # Add Real Name to Influencer Collaborations

  1. Changes
    - Add `real_name` text column to `marketing_influencer_collaborations` table
    - This allows tracking the influencer's real name separately from their social media handle

  2. Notes
    - Column is optional (nullable) as existing records may not have this information
*/

ALTER TABLE marketing_influencer_collaborations
ADD COLUMN IF NOT EXISTS real_name text;
