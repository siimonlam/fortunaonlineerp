import { createClient } from '@supabase/supabase-js';

const supabaseClientUrl = import.meta.env.VITE_SUPABASE_CLIENT_URL;
const supabaseClientAnonKey = import.meta.env.VITE_SUPABASE_CLIENT_ANON_KEY;

if (!supabaseClientUrl || !supabaseClientAnonKey) {
  console.warn('Client database credentials not configured. Client database features will not work.');
}

export const supabaseClient = supabaseClientUrl && supabaseClientAnonKey
  ? createClient(supabaseClientUrl, supabaseClientAnonKey)
  : null;
