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
    console.log('=== AUTH DEBUG START ===');
    console.log('Current URL:', window.location.href);
    console.log('URL Search:', window.location.search);
    console.log('URL Hash:', window.location.hash);
    console.log('URL Pathname:', window.location.pathname);
    console.log('=== AUTH DEBUG END ===');

    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[AuthProvider] Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[AuthProvider] Error getting session:', error);
        }

        if (!mounted) return;

        console.log('[AuthProvider] Initial session result:', session?.user?.email || 'No user');
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (err) {
        console.error('[AuthProvider] Exception in initializeAuth:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] Auth state changed:', event);
      console.log('[AuthProvider] Session user:', session?.user?.email || 'No user');

      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN') {
        console.log('[AuthProvider] User signed in successfully');

        if (window.location.search.includes('code=') || window.location.hash.includes('access_token')) {
          console.log('[AuthProvider] Cleaning OAuth params from URL');
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        try {
          if (session?.user) {
            const { data: existingStaff } = await supabase
              .from('staff')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!existingStaff) {
              console.log('[AuthProvider] Creating staff record');
              await supabase.from('staff').insert({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.user_metadata.full_name || session.user.email!.split('@')[0],
              });
            }
          }
        } catch (error) {
          console.error('[AuthProvider] Error creating staff record:', error);
        }
      }

      if (event === 'SIGNED_OUT') {
        console.log('[AuthProvider] User signed out');
      }
    });

    return () => {
      console.log('[AuthProvider] Cleanup: unmounting');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const redirectTo = window.location.origin;
    console.log('[AuthProvider] signInWithGoogle called');
    console.log('[AuthProvider] Redirect URL:', redirectTo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
      },
    });

    if (error) {
      console.error('[AuthProvider] Google OAuth error:', error);
      throw error;
    }

    console.log('[AuthProvider] OAuth redirect initiated (you will be redirected to Google)');
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log('[AuthProvider] signInWithEmail called for:', email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[AuthProvider] Sign in error:', error);
      throw error;
    }
    console.log('[AuthProvider] Email sign-in successful');
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    console.log('[AuthProvider] signUpWithEmail called for:', email);
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
      console.error('[AuthProvider] Sign up error:', error);
      throw error;
    }

    if (data.user && !data.session) {
      console.log('[AuthProvider] Email confirmation required');
      alert('Please check your email to confirm your account.');
    } else {
      console.log('[AuthProvider] Sign up successful');
    }
  };

  const signOut = async () => {
    console.log('[AuthProvider] signOut called');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[AuthProvider] Sign out error:', error);
      throw error;
    }
    console.log('[AuthProvider] Sign out successful');
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
