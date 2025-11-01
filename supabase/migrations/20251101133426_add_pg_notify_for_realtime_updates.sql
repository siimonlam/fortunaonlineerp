/*
  # Add pg_notify triggers for realtime updates
  
  1. Purpose
    - Work around Supabase Realtime RLS limitations with SECURITY DEFINER functions
    - Use pg_notify to broadcast changes to all authenticated users
    - Let the client-side filter out changes they don't have access to
    
  2. Changes
    - Create notify function for projects table
    - Add trigger to broadcast on INSERT, UPDATE, DELETE
    
  3. Security
    - Broadcasts to all authenticated users via pg_notify
    - Client-side will still respect RLS when fetching data
*/

-- Create a function to notify on project changes
CREATE OR REPLACE FUNCTION notify_project_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For DELETE operations, use OLD
  IF (TG_OP = 'DELETE') THEN
    PERFORM pg_notify(
      'project_changes',
      json_build_object(
        'operation', TG_OP,
        'record', row_to_json(OLD)
      )::text
    );
    RETURN OLD;
  ELSE
    -- For INSERT and UPDATE operations, use NEW
    PERFORM pg_notify(
      'project_changes',
      json_build_object(
        'operation', TG_OP,
        'record', row_to_json(NEW)
      )::text
    );
    RETURN NEW;
  END IF;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS project_change_trigger ON projects;

-- Create trigger for projects table
CREATE TRIGGER project_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW
EXECUTE FUNCTION notify_project_change();
