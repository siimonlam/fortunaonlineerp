/*
  # Fix ComSec Parent Client IDs

  1. Problem
    - parent_client_id values are corrupted (e.g., C88ce, Ca35e)
    - These should match the client_id which now has the correct format (e.g., C0017)
    
  2. Solution
    - Set parent_client_id = client_id for all comsec_clients
    - This ensures they match the correct client numbers
*/

-- Update parent_client_id to match client_id
UPDATE comsec_clients
SET parent_client_id = client_id
WHERE client_id IS NOT NULL;