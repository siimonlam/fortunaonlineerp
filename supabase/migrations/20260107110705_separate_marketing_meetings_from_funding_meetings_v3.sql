/*
  # Separate Marketing Meetings from Funding Project Meetings

  1. Changes
    - Create new `marketing_meetings` table specifically for marketing projects
    - Migrate existing marketing meetings from `meetings` table to `marketing_meetings`
    - Remove `marketing_project_id` from `meetings` table (keep it funding-only)
    - Create proper RLS policies for marketing_meetings

  2. New Tables
    - `marketing_meetings`
      - `id` (uuid, primary key)
      - `marketing_project_id` (uuid, foreign key to marketing_projects)
      - `title` (text, meeting title)
      - `description` (text, meeting notes)
      - `meeting_date` (timestamptz)
      - `location` (text)
      - `attendees` (text[])
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on marketing_meetings
    - Allow marketing project staff to view/create/edit/delete meetings
    - Funding project meetings remain in `meetings` table with existing policies
*/

-- Create marketing_meetings table
CREATE TABLE IF NOT EXISTS marketing_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid NOT NULL REFERENCES marketing_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  meeting_date timestamptz NOT NULL,
  location text DEFAULT '',
  attendees text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_project_id ON marketing_meetings(marketing_project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_meetings_date ON marketing_meetings(meeting_date DESC);

-- Migrate existing marketing meetings from meetings table to marketing_meetings
INSERT INTO marketing_meetings (
  id,
  marketing_project_id,
  title,
  description,
  meeting_date,
  location,
  attendees,
  created_by,
  created_at,
  updated_at
)
SELECT
  id,
  marketing_project_id,
  title,
  description,
  meeting_date,
  location,
  attendees,
  created_by,
  created_at,
  updated_at
FROM meetings
WHERE marketing_project_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Drop old policies that reference marketing_project_id
DROP POLICY IF EXISTS "Users can view accessible meetings" ON meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update meetings they have access to" ON meetings;
DROP POLICY IF EXISTS "Users can delete meetings they have access to" ON meetings;

-- Delete marketing meetings from the original meetings table
DELETE FROM meetings WHERE marketing_project_id IS NOT NULL;

-- Remove marketing_project_id column from meetings table (funding only now)
ALTER TABLE meetings DROP COLUMN IF EXISTS marketing_project_id;

-- Enable RLS on marketing_meetings
ALTER TABLE marketing_meetings ENABLE ROW LEVEL SECURITY;

-- Marketing meetings policies (using correct column names: project_id and user_id)
CREATE POLICY "Users can view marketing meetings they have access to"
  ON marketing_meetings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_meetings.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Marketing project staff can create meetings"
  ON marketing_meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_meetings.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Marketing project staff can update meetings"
  ON marketing_meetings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_meetings.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_meetings.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Marketing project staff can delete meetings"
  ON marketing_meetings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketing_projects mp
      WHERE mp.id = marketing_meetings.marketing_project_id
      AND (
        mp.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM marketing_project_staff mps
          WHERE mps.project_id = mp.id
          AND mps.user_id = auth.uid()
        )
      )
    )
  );

-- Enable realtime for marketing_meetings
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_meetings;

-- Recreate funding-only meeting policies
CREATE POLICY "Users can view funding project meetings"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    )
  );

CREATE POLICY "Users can create funding project meetings"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    )
  );

CREATE POLICY "Users can update funding project meetings"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    )
  )
  WITH CHECK (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    )
  );

CREATE POLICY "Users can delete funding project meetings"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = meetings.project_id
    )
  );
