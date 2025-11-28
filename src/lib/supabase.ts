import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type Database = {
  public: {
    Tables: {
      staff: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
      statuses: {
        Row: {
          id: string;
          name: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          order_index: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          order_index?: number;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status_id: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status_id: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          status_id?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      project_staff: {
        Row: {
          id: string;
          project_id: string;
          staff_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          staff_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          staff_id?: string;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          assigned_to: string | null;
          deadline: string | null;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          assigned_to?: string | null;
          deadline?: string | null;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string | null;
          assigned_to?: string | null;
          deadline?: string | null;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
