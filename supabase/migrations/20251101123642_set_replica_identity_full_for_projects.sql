/*
  # Set Replica Identity to FULL for Projects Table

  1. Purpose
    - Ensure all column updates in the projects table are broadcast via real-time
    - By default, only primary key changes are included in updates
    - Setting to FULL includes all column values in the change payload

  2. Changes
    - Set replica identity to FULL for projects table
    - This ensures real-time updates include all changed fields

  3. Why This Matters
    - When User B updates company_name, User A needs to see the change
    - With default replica identity, only the ID is broadcast
    - With FULL replica identity, all updated columns are included
*/

-- Set replica identity to FULL for the projects table
ALTER TABLE projects REPLICA IDENTITY FULL;