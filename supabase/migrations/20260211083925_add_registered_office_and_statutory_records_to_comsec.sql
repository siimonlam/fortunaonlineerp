/*
  # Add Registered Office Address and Statutory Records Fields
  
  1. Changes
    - Add `registered_office_address` text field to comsec_clients
    - Add `statutory_records_kept_with_secretary` boolean field to comsec_clients
  
  2. Purpose
    - Track registered office address separately from general address
    - Track whether statutory records are kept with company secretary
*/

-- Add registered office address field
ALTER TABLE comsec_clients
ADD COLUMN IF NOT EXISTS registered_office_address text;

-- Add statutory records checkbox field
ALTER TABLE comsec_clients
ADD COLUMN IF NOT EXISTS statutory_records_kept_with_secretary boolean DEFAULT false;
