/*
  # Set Replica Identity to FULL for All Real-time Tables

  1. Purpose
    - Ensure all column updates are broadcast via real-time for all tables
    - Enable users to see changes immediately without browser refresh

  2. Tables Updated
    - clients
    - tasks
    - project_staff
    - statuses
    - status_managers
    - staff
    - project_types

  3. Why FULL Replica Identity
    - Broadcasts all column values in change events
    - Enables real-time synchronization across all users
    - Critical for multi-user collaboration
*/

-- Set replica identity to FULL for all real-time tables
ALTER TABLE clients REPLICA IDENTITY FULL;
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE project_staff REPLICA IDENTITY FULL;
ALTER TABLE statuses REPLICA IDENTITY FULL;
ALTER TABLE status_managers REPLICA IDENTITY FULL;
ALTER TABLE staff REPLICA IDENTITY FULL;
ALTER TABLE project_types REPLICA IDENTITY FULL;
ALTER TABLE user_roles REPLICA IDENTITY FULL;
ALTER TABLE project_permissions REPLICA IDENTITY FULL;
ALTER TABLE client_permissions REPLICA IDENTITY FULL;