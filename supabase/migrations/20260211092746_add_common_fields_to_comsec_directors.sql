/*
  # Add Common Fields to Directors

  1. Changes
    - Add `country_region` field for both individual and corporation directors
    - Add `date_of_appointment` field
    - Add `date_of_resignation` field
    - Add `is_first_director` boolean field
  
  2. Purpose
    - Track appointment and resignation dates
    - Identify first directors
    - Track country/region information
*/

-- Add common fields for both director types
ALTER TABLE comsec_directors
ADD COLUMN IF NOT EXISTS country_region text,
ADD COLUMN IF NOT EXISTS date_of_appointment date,
ADD COLUMN IF NOT EXISTS date_of_resignation date,
ADD COLUMN IF NOT EXISTS is_first_director boolean DEFAULT false;
