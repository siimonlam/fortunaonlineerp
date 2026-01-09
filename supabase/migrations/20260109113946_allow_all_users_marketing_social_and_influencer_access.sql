/*
  # Allow All Users to Access Marketing Social Media and Influencer Sections

  This migration updates RLS policies to allow all authenticated users to view and edit:
  1. Social media posts and steps
  2. Influencer collaborations
  3. Marketing tasks (already done, but included for reference)

  1. Changes
    - Drop restrictive RLS policies on marketing_social_posts
    - Drop restrictive RLS policies on marketing_social_post_steps
    - Drop restrictive RLS policies on marketing_influencer_collaborations
    - Create simple "allow all authenticated" policies for all tables
  
  2. Security
    - RLS remains enabled
    - All authenticated users can access all marketing social media content
    - All authenticated users can access all influencer collaborations
    - Anonymous users cannot access any data
*/

-- ============================================================================
-- MARKETING SOCIAL POSTS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view posts for their marketing projects" ON marketing_social_posts;
DROP POLICY IF EXISTS "Users can create posts for their marketing projects" ON marketing_social_posts;
DROP POLICY IF EXISTS "Users can update posts they created or are assigned to" ON marketing_social_posts;
DROP POLICY IF EXISTS "Users can delete posts they created" ON marketing_social_posts;

-- Create new simple policies
CREATE POLICY "All authenticated users can view marketing social posts"
  ON marketing_social_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can create marketing social posts"
  ON marketing_social_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update marketing social posts"
  ON marketing_social_posts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "All authenticated users can delete marketing social posts"
  ON marketing_social_posts FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- MARKETING SOCIAL POST STEPS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view steps for posts they have access to" ON marketing_social_post_steps;
DROP POLICY IF EXISTS "Users can create steps for posts they have access to" ON marketing_social_post_steps;
DROP POLICY IF EXISTS "Users can update steps they are assigned to or have project acc" ON marketing_social_post_steps;
DROP POLICY IF EXISTS "Users can delete steps for posts they have access to" ON marketing_social_post_steps;

-- Create new simple policies
CREATE POLICY "All authenticated users can view marketing social post steps"
  ON marketing_social_post_steps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can create marketing social post steps"
  ON marketing_social_post_steps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update marketing social post steps"
  ON marketing_social_post_steps FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "All authenticated users can delete marketing social post steps"
  ON marketing_social_post_steps FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- MARKETING INFLUENCER COLLABORATIONS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view collaborations for their marketing projects" ON marketing_influencer_collaborations;
DROP POLICY IF EXISTS "Users can create collaborations for their marketing projects" ON marketing_influencer_collaborations;
DROP POLICY IF EXISTS "Users can update collaborations for their marketing projects" ON marketing_influencer_collaborations;
DROP POLICY IF EXISTS "Users can delete collaborations they created" ON marketing_influencer_collaborations;

-- Create new simple policies
CREATE POLICY "All authenticated users can view influencer collaborations"
  ON marketing_influencer_collaborations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can create influencer collaborations"
  ON marketing_influencer_collaborations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update influencer collaborations"
  ON marketing_influencer_collaborations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "All authenticated users can delete influencer collaborations"
  ON marketing_influencer_collaborations FOR DELETE
  TO authenticated
  USING (true);
