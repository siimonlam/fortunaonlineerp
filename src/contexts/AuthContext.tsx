import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Initializing auth...');

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthProvider: Initial session:', session?.user?.email || 'No user');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthProvider: Auth state change:', event, session?.user?.email || 'No user');

      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && (window.location.search.includes('code=') || window.location.hash.includes('access_token'))) {
        console.log('AuthProvider: Cleaning up OAuth parameters from URL');
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (session?.user) {
        try {
          const { data: existingStaff } = await supabase
            .from('staff')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!existingStaff) {
            console.log('AuthProvider: Creating staff record for:', session.user.email);
            await supabase.from('staff').insert({
              id: session.user.id,
              email: session.user.email!,
              full_name: session.user.user_metadata.full_name || session.user.email!.split('@')[0],
            });
          }
        } catch (error) {
          console.error('AuthProvider: Error creating staff record:', error);
        }
      }
    });

    return () => {
      console.log('AuthProvider: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const redirectTo = window.location.origin;
    console.log('AuthProvider: Starting Google OAuth with redirectTo:', redirectTo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
      },
    });

    if (error) {
      console.error('AuthProvider: Google OAuth error:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log('AuthProvider: Signing in with email:', email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('AuthProvider: Sign in error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    console.log('AuthProvider: Signing up:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      console.error('AuthProvider: Sign up error:', error);
      throw error;
    }

    if (data.user && !data.session) {
      alert('Please check your email to confirm your account.');
    }
  };

  const signOut = async () => {
    console.log('AuthProvider: Signing out...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('AuthProvider: Sign out error:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
