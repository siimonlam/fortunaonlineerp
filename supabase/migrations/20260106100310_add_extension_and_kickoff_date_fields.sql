/*
  # Add Extension and Kickoff Date Fields to Projects

  1. Changes
    - Add `extension` boolean field to track if project has extension
    - Add `kickoff_date_with_first_payment` timestamptz field for kickoff date tracking
    
  2. Purpose
    - These fields are used in the Funding project Important Dates section
    - Extension checkbox to indicate project extension status
    - Kickoff date tracks the project kickoff with first payment
*/

-- Add extension checkbox field
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS extension boolean DEFAULT false;

-- Add kickoff date with first payment field
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS kickoff_date_with_first_payment timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN projects.extension IS 'Indicates if the project has an extension';
COMMENT ON COLUMN projects.kickoff_date_with_first_payment IS 'Date when project kicks off with first payment';
