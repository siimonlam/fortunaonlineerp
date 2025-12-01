/*
  # Enable Realtime for Project Type Permissions

  1. Changes
    - Enable realtime replication for project_type_permissions table
    - Set replica identity to FULL to track all changes

  2. Notes
    - This allows users to see permission changes in real-time without page refresh
    - When an admin grants or revokes Com Sec access, the user will see the button appear/disappear
*/

-- Enable realtime for project_type_permissions
ALTER PUBLICATION supabase_realtime ADD TABLE project_type_permissions;

-- Set replica identity to FULL for comprehensive change tracking
ALTER TABLE project_type_permissions REPLICA IDENTITY FULL;
