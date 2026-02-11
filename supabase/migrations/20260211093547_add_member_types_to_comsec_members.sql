/*
  # Add Member Types to ComSec Members

  1. Changes
    - Add `member_type` field to distinguish between 'individual' and 'corporation'
    - Add fields for individual members:
      - `name_chinese` (text)
      - `name_english` (text)
      - `address` (text)
      - `hkid` (text)
      - `passport` (text)
    - Add fields for corporation members:
      - `company_name_chinese` (text)
      - `company_name_english` (text)
      - `registered_office_address` (text)
      - `company_number` (text)
    - Keep existing `name` and `id_number` fields for backward compatibility
  
  2. Purpose
    - Support both individual and corporation members
    - Track detailed information for each member type
*/

-- Add member type and new fields
ALTER TABLE comsec_members
ADD COLUMN IF NOT EXISTS member_type text DEFAULT 'individual' CHECK (member_type IN ('individual', 'corporation')),
ADD COLUMN IF NOT EXISTS name_chinese text,
ADD COLUMN IF NOT EXISTS name_english text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS hkid text,
ADD COLUMN IF NOT EXISTS passport text,
ADD COLUMN IF NOT EXISTS company_name_chinese text,
ADD COLUMN IF NOT EXISTS company_name_english text,
ADD COLUMN IF NOT EXISTS registered_office_address text,
ADD COLUMN IF NOT EXISTS company_number text;
