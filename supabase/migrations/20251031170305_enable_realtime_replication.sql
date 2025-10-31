/*
  # Enable Real-time Replication

  1. Changes
    - Enable real-time replication for projects table
    - Enable real-time replication for clients table  
    - Enable real-time replication for tasks table
    
  2. Purpose
    - Allow multiple users to see live updates without refreshing
    - Improve collaboration and data synchronization
    - Automatically update UI when database changes occur

  3. Notes
    - Real-time subscriptions are already implemented in the frontend
    - Changes will be broadcast to all connected clients instantly
*/

-- Enable real-time for projects table
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

-- Enable real-time for clients table
ALTER PUBLICATION supabase_realtime ADD TABLE clients;

-- Enable real-time for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
