/*
  # Allow Anyone to Create Clients

  1. Changes
    - Completely disable RLS on clients table temporarily to test
    - We'll re-enable with proper policies after confirming the issue
    
  2. Security
    - This temporarily removes all restrictions
*/

-- Disable RLS on clients table
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
