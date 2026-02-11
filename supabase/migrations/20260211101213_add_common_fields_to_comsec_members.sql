/*
  # Add Common Fields to ComSec Members

  1. Changes
    - Add shareholding and member tracking fields that apply to both individual and corporation members:
      - `country_region` (text)
      - `class_of_share` (text)
      - `issued_shares` (numeric)
      - `total_consideration` (numeric)
      - `current_shareholding` (numeric)
      - `current_shareholding_percentage` (numeric)
      - `certificate_no` (text)
      - `distinctive_no` (text)
      - `folio_no` (text)
      - `date_entered_as_member` (date)
      - `date_ceased_member` (date)
      - `is_founder_member` (boolean)
      - `significant_controller` (text)
  
  2. Purpose
    - Track shareholding information for all members
    - Record membership dates and status
    - Track significant controller designation
*/

ALTER TABLE comsec_members
ADD COLUMN IF NOT EXISTS country_region text,
ADD COLUMN IF NOT EXISTS class_of_share text,
ADD COLUMN IF NOT EXISTS issued_shares numeric,
ADD COLUMN IF NOT EXISTS total_consideration numeric,
ADD COLUMN IF NOT EXISTS current_shareholding numeric,
ADD COLUMN IF NOT EXISTS current_shareholding_percentage numeric,
ADD COLUMN IF NOT EXISTS certificate_no text,
ADD COLUMN IF NOT EXISTS distinctive_no text,
ADD COLUMN IF NOT EXISTS folio_no text,
ADD COLUMN IF NOT EXISTS date_entered_as_member date,
ADD COLUMN IF NOT EXISTS date_ceased_member date,
ADD COLUMN IF NOT EXISTS is_founder_member boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS significant_controller text;
