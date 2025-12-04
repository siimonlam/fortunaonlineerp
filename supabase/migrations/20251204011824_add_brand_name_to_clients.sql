/*
  # Add brand_name column to clients table

  1. Changes
    - Add `brand_name` text column to `clients` table
    - Allow null values for brand_name
  
  2. Purpose
    - Enable storage of brand names for clients
    - Support brand name input in client onboarding and editing
*/

ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_name text;
