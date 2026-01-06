/*
  # Create Influencer Collaboration Tracking System

  1. New Tables
    - `marketing_influencer_collaborations`
      - `id` (uuid, primary key)
      - `marketing_project_id` (uuid, foreign key to marketing_projects)
      - `item` (text) - Item/product for collaboration
      - `collaborator_name` (text) - Influencer name
      - `platform` (text) - Social media platform
      - `category` (text) - Category/niche
      - `primary_market` (text) - Primary market/region
      - `page_link` (text) - Link to influencer profile
      - `follower_count` (integer) - Number of followers
      - `engagement` (decimal) - Engagement rate percentage
      - `suggested_price` (decimal) - Suggested compensation amount
      - `outreach_date` (date) - Date of first outreach
      - `address` (text) - Physical address if needed
      - `status` (text) - Contacted, Negotiating, Sent Sample, Posted
      - `collaboration_type` (text) - Type of collaboration
      - `compensation` (text) - Compensation details
      - `affiliate_link` (text) - Affiliate link if applicable
      - `coupon_code` (text) - Coupon code if provided
      - `post_link` (text) - Link to published post
      - `post_likes` (integer) - Number of likes on post
      - `post_comments` (integer) - Number of comments on post
      - `sales` (decimal) - Sales generated from collaboration
      - `created_by` (uuid, foreign key to staff)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can view collaborations for their marketing projects
    - Users can create/edit/delete collaborations they have access to
*/

-- Create marketing_influencer_collaborations table
CREATE TABLE IF NOT EXISTS marketing_influencer_collaborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid NOT NULL REFERENCES marketing_projects(id) ON DELETE CASCADE,
  item text,
  collaborator_name text NOT NULL,
  platform text,
  category text,
  primary_market text,
  page_link text,
  follower_count integer,
  engagement numeric(5, 2),
  suggested_price numeric(12, 2),
  outreach_date date,
  address text,
  status text DEFAULT 'Contacted' CHECK (status IN ('Contacted', 'Negotiating', 'Sent Sample', 'Posted')),
  collaboration_type text,
  compensation text,
  affiliate_link text,
  coupon_code text,
  post_link text,
  post_likes integer DEFAULT 0,
  post_comments integer DEFAULT 0,
  sales numeric(12, 2) DEFAULT 0,
  created_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_influencer_collab_project ON marketing_influencer_collaborations(marketing_project_id);
CREATE INDEX IF NOT EXISTS idx_influencer_collab_status ON marketing_influencer_collaborations(status);
CREATE INDEX IF NOT EXISTS idx_influencer_collab_platform ON marketing_influencer_collaborations(platform);
CREATE INDEX IF NOT EXISTS idx_influencer_collab_created_by ON marketing_influencer_collaborations(created_by);

-- Enable RLS
ALTER TABLE marketing_influencer_collaborations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view collaborations for their marketing projects"
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

CREATE POLICY "Users can create collaborations for their marketing projects"
  ON marketing_influencer_collaborations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_project_staff mps
      WHERE mps.project_id = marketing_influencer_collaborations.marketing_project_id
      AND mps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update collaborations for their marketing projects"
  ON marketing_influencer_collaborations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_project_staff mps
      WHERE mps.project_id = marketing_influencer_collaborations.marketing_project_id
      AND mps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete collaborations they created"
  ON marketing_influencer_collaborations FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM marketing_project_staff mps
      WHERE mps.project_id = marketing_influencer_collaborations.marketing_project_id
      AND mps.user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_influencer_collab_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_influencer_collab_updated_at
  BEFORE UPDATE ON marketing_influencer_collaborations
  FOR EACH ROW
  EXECUTE FUNCTION update_influencer_collab_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_influencer_collaborations;
