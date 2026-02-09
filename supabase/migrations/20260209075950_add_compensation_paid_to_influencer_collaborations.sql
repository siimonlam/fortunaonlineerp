/*
  # Add Compensation Paid Field to Influencer Collaborations

  1. Changes
    - Add `compensation_paid` boolean field to `marketing_influencer_collaborations` table
    - Default value: false
    - Tracks whether compensation has been paid to the influencer

  2. Purpose
    - Enable tracking of payment status for influencer collaborations
    - Help teams manage payment obligations and identify outstanding payments
*/

-- Add compensation_paid field to marketing_influencer_collaborations table
ALTER TABLE marketing_influencer_collaborations
ADD COLUMN IF NOT EXISTS compensation_paid boolean DEFAULT false;

-- Add index for filtering by compensation_paid status
CREATE INDEX IF NOT EXISTS idx_influencer_collab_compensation_paid ON marketing_influencer_collaborations(compensation_paid);
