/*
  # Add Facebook-Specific Fields

  1. Updates to facebook_accounts
    - Add `fan_count` (integer) - Number of fans/page likes
    - Add `category` (text) - Page category
    - Add `verification_status` (text) - Verification status

  2. Updates to facebook_posts
    - Add `status_type` (text) - Type of status (e.g., added_photos, shared_story)
    - Rename `shares_count` if needed, ensure it exists

  3. Updates to facebook_post_metrics
    - Add `engaged_users` (integer) - Number of unique users who engaged
    - Add `link_clicks` (integer) - Number of link clicks
    - Add `photo_clicks` (integer) - Number of photo clicks
    - Add `negative_feedback` (integer) - Number of negative feedback actions
    - Add `reaction_love` (jsonb) - Love reaction details
    - Add `reaction_haha` (jsonb) - Haha reaction details
    - Add `reaction_wow` (jsonb) - Wow reaction details
    - Add `reaction_sad` (jsonb) - Sad reaction details
    - Add `reaction_angry` (jsonb) - Angry reaction details

  4. Notes
    - All new fields have default values to ensure backward compatibility
    - JSONB type used for reaction details to store structured data
*/

-- Add fields to facebook_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_accounts' AND column_name = 'fan_count'
  ) THEN
    ALTER TABLE facebook_accounts ADD COLUMN fan_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_accounts' AND column_name = 'category'
  ) THEN
    ALTER TABLE facebook_accounts ADD COLUMN category text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_accounts' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE facebook_accounts ADD COLUMN verification_status text DEFAULT '';
  END IF;
END $$;

-- Add fields to facebook_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_posts' AND column_name = 'status_type'
  ) THEN
    ALTER TABLE facebook_posts ADD COLUMN status_type text DEFAULT '';
  END IF;
END $$;

-- Add fields to facebook_post_metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_post_metrics' AND column_name = 'engaged_users'
  ) THEN
    ALTER TABLE facebook_post_metrics ADD COLUMN engaged_users integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_post_metrics' AND column_name = 'link_clicks'
  ) THEN
    ALTER TABLE facebook_post_metrics ADD COLUMN link_clicks integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_post_metrics' AND column_name = 'photo_clicks'
  ) THEN
    ALTER TABLE facebook_post_metrics ADD COLUMN photo_clicks integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_post_metrics' AND column_name = 'negative_feedback'
  ) THEN
    ALTER TABLE facebook_post_metrics ADD COLUMN negative_feedback integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_post_metrics' AND column_name = 'reaction_love'
  ) THEN
    ALTER TABLE facebook_post_metrics ADD COLUMN reaction_love jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_post_metrics' AND column_name = 'reaction_haha'
  ) THEN
    ALTER TABLE facebook_post_metrics ADD COLUMN reaction_haha jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_post_metrics' AND column_name = 'reaction_wow'
  ) THEN
    ALTER TABLE facebook_post_metrics ADD COLUMN reaction_wow jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_post_metrics' AND column_name = 'reaction_sad'
  ) THEN
    ALTER TABLE facebook_post_metrics ADD COLUMN reaction_sad jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facebook_post_metrics' AND column_name = 'reaction_angry'
  ) THEN
    ALTER TABLE facebook_post_metrics ADD COLUMN reaction_angry jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN facebook_accounts.fan_count IS 'Number of fans/page likes';
COMMENT ON COLUMN facebook_accounts.category IS 'Page category';
COMMENT ON COLUMN facebook_accounts.verification_status IS 'Verification status (e.g., blue_verified, gray_verified, not_verified)';

COMMENT ON COLUMN facebook_posts.status_type IS 'Type of status update (e.g., added_photos, shared_story, mobile_status_update)';

COMMENT ON COLUMN facebook_post_metrics.engaged_users IS 'Number of unique users who engaged with the post';
COMMENT ON COLUMN facebook_post_metrics.link_clicks IS 'Number of clicks on links in the post';
COMMENT ON COLUMN facebook_post_metrics.photo_clicks IS 'Number of clicks on photos in the post';
COMMENT ON COLUMN facebook_post_metrics.negative_feedback IS 'Number of negative feedback actions (hide, report spam, etc.)';
COMMENT ON COLUMN facebook_post_metrics.reaction_love IS 'Love reaction details as JSON';
COMMENT ON COLUMN facebook_post_metrics.reaction_haha IS 'Haha reaction details as JSON';
COMMENT ON COLUMN facebook_post_metrics.reaction_wow IS 'Wow reaction details as JSON';
COMMENT ON COLUMN facebook_post_metrics.reaction_sad IS 'Sad reaction details as JSON';
COMMENT ON COLUMN facebook_post_metrics.reaction_angry IS 'Angry reaction details as JSON';