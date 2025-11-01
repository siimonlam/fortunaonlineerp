/*
  # Enable Comprehensive Real-time Replication

  1. Purpose
    - Enable real-time updates for all project management tables
    - Ensure changes by any user are immediately visible to all other users

  2. Tables Added to Real-time Publication
    - `project_staff` - For staff assignments
    - `project_types` - For project type changes
    - `statuses` - For status changes
    - `staff` - For user profile updates
    - `user_roles` - For role changes
    - `project_permissions` - For permission changes
    - `client_permissions` - For client access changes
    - `project_assignments` - For project assignments
    - `status_permissions` - For status permission changes

  3. Notes
    - All tables use default replica identity (primary key)
    - Real-time is critical for multi-user collaboration
    - Changes will be broadcast immediately to all connected clients
*/

-- Add all necessary tables to the supabase_realtime publication
DO $$
BEGIN
  -- Add project_staff
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'project_staff'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_staff;
  END IF;

  -- Add project_types
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'project_types'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_types;
  END IF;

  -- Add statuses
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'statuses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE statuses;
  END IF;

  -- Add staff
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'staff'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE staff;
  END IF;

  -- Add user_roles
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_roles;
  END IF;

  -- Add project_permissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'project_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_permissions;
  END IF;

  -- Add client_permissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'client_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE client_permissions;
  END IF;

  -- Add project_assignments
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'project_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_assignments;
  END IF;

  -- Add status_permissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'status_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE status_permissions;
  END IF;
END $$;