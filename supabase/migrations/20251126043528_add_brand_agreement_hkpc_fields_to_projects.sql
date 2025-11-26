/*
  # Add Brand, Agreement, and HKPC Officer Fields to Projects

  1. New Columns
    - `brand_name` (text) - Brand name for the project
    - `agreement_sign_date` (timestamptz) - Agreement signing date and time
    - `hkpc_officer_name` (text) - HKPC officer's name
    - `hkpc_officer_email` (text) - HKPC officer's email
    - `hkpc_officer_phone` (text) - HKPC officer's phone number

  2. Notes
    - All fields are nullable as they are optional
    - agreement_sign_date uses timestamptz to store both date and time
*/

-- Add new columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agreement_sign_date timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hkpc_officer_name text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hkpc_officer_email text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hkpc_officer_phone text;