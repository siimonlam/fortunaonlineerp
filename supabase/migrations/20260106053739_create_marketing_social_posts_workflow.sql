/*
  # Create Marketing Social Media Post Workflow System

  1. New Tables
    - `marketing_social_posts`
      - `id` (uuid, primary key)
      - `marketing_project_id` (uuid, foreign key to marketing_projects)
      - `title` (text) - Post title
      - `content` (text) - Post content/description
      - `design_link` (text) - Link to design resources
      - `scheduled_post_date` (timestamptz) - When the post should be published
      - `current_step` (integer) - Current workflow step (1, 2, or 3)
      - `version` (integer) - Content version number
      - `draft_edit_date` (timestamptz) - Last edit date of draft
      - `status` (text) - Overall status: draft, in_approval, approved, posted, cancelled
      - `created_by` (uuid, foreign key to staff)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `marketing_social_post_steps`
      - `id` (uuid, primary key)
      - `post_id` (uuid, foreign key to marketing_social_posts)
      - `step_number` (integer) - 1: Content Drafting, 2: Approval, 3: Content Posted
      - `step_name` (text) - Name of the step
      - `assigned_to` (uuid, foreign key to staff) - User assigned to this step
      - `due_date` (timestamptz) - Deadline for this step
      - `completed_at` (timestamptz) - When step was completed
      - `completed_by` (uuid, foreign key to staff) - User who completed the step
      - `status` (text) - pending, in_progress, completed
      - `notes` (text) - Step notes or comments
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can view posts for projects they have access to
    - Users can edit posts they're assigned to or created
    - Users can update steps they're assigned to
*/

-- Create marketing_social_posts table
CREATE TABLE IF NOT EXISTS marketing_social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid NOT NULL REFERENCES marketing_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text DEFAULT '',
  design_link text,
  scheduled_post_date timestamptz,
  current_step integer DEFAULT 1 CHECK (current_step BETWEEN 1 AND 3),
  version integer DEFAULT 1,
  draft_edit_date timestamptz DEFAULT now(),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'in_approval', 'approved', 'posted', 'cancelled')),
  created_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create marketing_social_post_steps table
CREATE TABLE IF NOT EXISTS marketing_social_post_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES marketing_social_posts(id) ON DELETE CASCADE,
  step_number integer NOT NULL CHECK (step_number BETWEEN 1 AND 3),
  step_name text NOT NULL,
  assigned_to uuid REFERENCES staff(id) ON DELETE SET NULL,
  due_date timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(post_id, step_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_social_posts_project ON marketing_social_posts(marketing_project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_social_posts_created_by ON marketing_social_posts(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_social_posts_status ON marketing_social_posts(status);
CREATE INDEX IF NOT EXISTS idx_marketing_social_post_steps_post ON marketing_social_post_steps(post_id);
CREATE INDEX IF NOT EXISTS idx_marketing_social_post_steps_assigned ON marketing_social_post_steps(assigned_to);

-- Enable RLS
ALTER TABLE marketing_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_social_post_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketing_social_posts
CREATE POLICY "Users can view posts for their marketing projects"
  ON marketing_social_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_project_staff mps
      WHERE mps.project_id = marketing_social_posts.marketing_project_id
      AND mps.user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create posts for their marketing projects"
  ON marketing_social_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_project_staff mps
      WHERE mps.project_id = marketing_social_posts.marketing_project_id
      AND mps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update posts they created or are assigned to"
  ON marketing_social_posts FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM marketing_project_staff mps
      WHERE mps.project_id = marketing_social_posts.marketing_project_id
      AND mps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete posts they created"
  ON marketing_social_posts FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for marketing_social_post_steps
CREATE POLICY "Users can view steps for posts they have access to"
  ON marketing_social_post_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_social_posts msp
      JOIN marketing_project_staff mps ON mps.project_id = msp.marketing_project_id
      WHERE msp.id = marketing_social_post_steps.post_id
      AND mps.user_id = auth.uid()
    )
    OR assigned_to = auth.uid()
  );

CREATE POLICY "Users can create steps for posts they have access to"
  ON marketing_social_post_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_social_posts msp
      JOIN marketing_project_staff mps ON mps.project_id = msp.marketing_project_id
      WHERE msp.id = marketing_social_post_steps.post_id
      AND mps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update steps they are assigned to or have project access"
  ON marketing_social_post_steps FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM marketing_social_posts msp
      JOIN marketing_project_staff mps ON mps.project_id = msp.marketing_project_id
      WHERE msp.id = marketing_social_post_steps.post_id
      AND mps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete steps for posts they have access to"
  ON marketing_social_post_steps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_social_posts msp
      JOIN marketing_project_staff mps ON mps.project_id = msp.marketing_project_id
      WHERE msp.id = marketing_social_post_steps.post_id
      AND mps.user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_marketing_social_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_marketing_social_posts_updated_at
  BEFORE UPDATE ON marketing_social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_social_posts_updated_at();

CREATE TRIGGER trigger_update_marketing_social_post_steps_updated_at
  BEFORE UPDATE ON marketing_social_post_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_social_posts_updated_at();

-- Create function to auto-create initial step when post is created
CREATE OR REPLACE FUNCTION create_initial_post_step()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO marketing_social_post_steps (
    post_id,
    step_number,
    step_name,
    assigned_to,
    due_date,
    status
  ) VALUES (
    NEW.id,
    1,
    'Content Drafting',
    NEW.created_by,
    NEW.scheduled_post_date,
    'in_progress'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_initial_post_step
  AFTER INSERT ON marketing_social_posts
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_post_step();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_social_post_steps;
