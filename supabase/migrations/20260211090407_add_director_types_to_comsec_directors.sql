/*
  # Add Director Types to Com Sec Directors

  1. Changes
    - Add `director_type` field (individual or corporation)
    - Add fields for Individual directors:
      - name_chinese
      - name_english
      - correspondence_address
      - residential_address
      - hkid
      - passport
    - Add fields for Corporation directors:
      - company_name_chinese
      - company_name_english
      - registered_office_address
      - br_number
  
  2. Purpose
    - Support two types of directors with different field requirements
    - Individual directors have personal information
    - Corporation directors have company information
*/

-- Add director type field
ALTER TABLE comsec_directors
ADD COLUMN IF NOT EXISTS director_type text DEFAULT 'individual' CHECK (director_type IN ('individual', 'corporation'));

-- Add Individual director fields
ALTER TABLE comsec_directors
ADD COLUMN IF NOT EXISTS name_chinese text,
ADD COLUMN IF NOT EXISTS name_english text,
ADD COLUMN IF NOT EXISTS correspondence_address text,
ADD COLUMN IF NOT EXISTS residential_address text,
ADD COLUMN IF NOT EXISTS hkid text,
ADD COLUMN IF NOT EXISTS passport text;

-- Add Corporation director fields
ALTER TABLE comsec_directors
ADD COLUMN IF NOT EXISTS company_name_chinese text,
ADD COLUMN IF NOT EXISTS company_name_english text,
ADD COLUMN IF NOT EXISTS registered_office_address text,
ADD COLUMN IF NOT EXISTS br_number text;

-- Make the existing 'name' field nullable since it will be replaced by type-specific fields
ALTER TABLE comsec_directors
ALTER COLUMN name DROP NOT NULL;
