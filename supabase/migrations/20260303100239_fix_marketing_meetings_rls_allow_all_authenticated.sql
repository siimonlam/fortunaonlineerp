/*
  # Fix Marketing Meetings RLS Policies
  
  1. Changes
    - Drop existing restrictive RLS policies on marketing_meetings
    - Create new policies that allow all authenticated users to manage meetings
    - Follows the same pattern as marketing_projects table
  
  2. Security
    - All authenticated users can create, view, update, and delete marketing meetings
    - Consistent with the marketing projects access model
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Marketing project staff can create meetings" ON marketing_meetings;
DROP POLICY IF EXISTS "Marketing project staff can update meetings" ON marketing_meetings;
DROP POLICY IF EXISTS "Marketing project staff can delete meetings" ON marketing_meetings;
DROP POLICY IF EXISTS "Users can view marketing meetings they have access to" ON marketing_meetings;

-- Create new policies allowing all authenticated users
CREATE POLICY "All authenticated users can view marketing meetings"
  ON marketing_meetings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can create marketing meetings"
  ON marketing_meetings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update marketing meetings"
  ON marketing_meetings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "All authenticated users can delete marketing meetings"
  ON marketing_meetings FOR DELETE
  TO authenticated
  USING (true);
