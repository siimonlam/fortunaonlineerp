/*
  # Add Screenshots to Influencer Collaborations

  1. Changes
    - Add `screenshots` (jsonb) - Array of screenshot objects with Drive URL, file ID, and upload date
    - Structure: [{"drive_url": "https://...", "file_id": "abc123", "filename": "20260402-JohnDoe-001.png", "uploaded_at": "2026-04-02T10:30:00Z"}]

  2. Purpose
    - Store multiple screenshot uploads per collaboration
    - Track screenshot metadata (Drive URL, file ID, filename, upload timestamp)
    - Enable display and management of collaboration evidence/proof
*/

-- Add screenshots column as jsonb array
ALTER TABLE marketing_influencer_collaborations
  ADD COLUMN IF NOT EXISTS screenshots jsonb DEFAULT '[]'::jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_influencer_collab_screenshots ON marketing_influencer_collaborations USING GIN (screenshots) WHERE screenshots IS NOT NULL AND screenshots != '[]'::jsonb;
