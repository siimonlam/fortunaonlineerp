/*
  # Add E-commerce and Other Industry Fields to Clients

  1. Changes
    - Add is_ecommerce boolean field to clients table
    - Add other_industry text field to clients table for when "Other" is selected
    
  2. Notes
    - is_ecommerce defaults to false
    - other_industry is nullable and only filled when industry = "Other"
*/

-- Add is_ecommerce field
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_ecommerce boolean DEFAULT false;

-- Add other_industry field for custom industry text
ALTER TABLE clients ADD COLUMN IF NOT EXISTS other_industry text;