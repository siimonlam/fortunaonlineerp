/*
  # Add Creative Fields and Ad Reference

  1. Changes
    - Add `ad_id` to `meta_ad_creatives` to link creatives to specific ads
    - Add `ad_format` to indicate type (image, video, carousel, collection, etc.)
    - Add `effective_object_url` for the actual landing page URL
    - Add missing fields from creatives table: client_number, marketing_reference
  
  2. Security
    - No RLS changes needed (existing policies apply)
*/

-- Add ad_id reference to link creatives to ads
ALTER TABLE meta_ad_creatives
ADD COLUMN IF NOT EXISTS ad_id text;

-- Add ad format field
ALTER TABLE meta_ad_creatives
ADD COLUMN IF NOT EXISTS ad_format text;

-- Add effective object URL (the actual link the ad goes to)
ALTER TABLE meta_ad_creatives
ADD COLUMN IF NOT EXISTS effective_object_url text;

-- Add client tracking fields
ALTER TABLE meta_ad_creatives
ADD COLUMN IF NOT EXISTS client_number text;

ALTER TABLE meta_ad_creatives
ADD COLUMN IF NOT EXISTS marketing_reference text;

-- Create index for ad_id lookups
CREATE INDEX IF NOT EXISTS idx_meta_ad_creatives_ad_id ON meta_ad_creatives(ad_id);
