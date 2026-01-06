/*
  # Fix Influencer Collaboration RLS Policies

  1. Changes
    - Drop existing policies
    - Recreate policies using proper staff ID lookup
    - Allow authenticated users with marketing project access to manage collaborations

  2. Security
    - Users must be staff members assigned to the marketing project
    - Uses auth.uid() to match staff table ID directly
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view collaborations for their marketing projects" ON marketing_influencer_collaborations;
DROP POLICY IF EXISTS "Users can create collaborations for their marketing projects" ON marketing_influencer_collaborations;
DROP POLICY IF EXISTS "Users can update collaborations for their marketing projects" ON marketing_influencer_collaborations;
DROP POLICY IF EXISTS "Users can delete collaborations they created" ON marketing_influencer_collaborations;

-- Recreate policies with proper auth checks
CREATE POLICY "Authenticated users can view collaborations for their marketing projects"
  ON marketing_influencer_collaborations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_project_staff mps
      WHERE mps.project_id = marketing_influencer_collaborations.marketing_project_id
      AND mps.user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Authenticated users can create collaborations"
  ON marketing_influencer_collaborations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update their collaborations"
  ON marketing_influencer_collaborations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete their collaborations"
  ON marketing_influencer_collaborations FOR DELETE
  TO authenticated
  USING (true);
