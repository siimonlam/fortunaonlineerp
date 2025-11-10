/*
  # Create Com Sec Client Comments Table

  1. New Tables
    - `comsec_client_comments`
      - `id` (uuid, primary key)
      - `comsec_client_id` (uuid, references comsec_clients) - Link to com sec client
      - `comment` (text, required) - Comment text
      - `created_by` (uuid, references auth.users) - User who created the comment
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on comsec_client_comments table
    - Users can view all comments
    - Users can insert their own comments
    - Users can update/delete their own comments

  3. Important Notes
    - This table stores comments/notes for com sec clients
    - Similar to project comments but for com sec clients
*/

-- Create comsec_client_comments table
CREATE TABLE IF NOT EXISTS comsec_client_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comsec_client_id uuid REFERENCES comsec_clients(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_comsec_client_comments_client ON comsec_client_comments(comsec_client_id);
CREATE INDEX IF NOT EXISTS idx_comsec_client_comments_created_at ON comsec_client_comments(created_at DESC);

-- Enable RLS
ALTER TABLE comsec_client_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comsec_client_comments

-- Policy: Authenticated users can view all comments
CREATE POLICY "Authenticated users can view all comments"
  ON comsec_client_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert comments
CREATE POLICY "Authenticated users can insert comments"
  ON comsec_client_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON comsec_client_comments
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON comsec_client_comments
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());