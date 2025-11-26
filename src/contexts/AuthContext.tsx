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
    const checkForAuthError = () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      const error = params.get('error') || hashParams.get('error');
      const errorDescription = params.get('error_description') || hashParams.get('error_description');

      if (error) {
        console.error('OAuth error:', error, errorDescription);
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
      }
      return false;
    };

    const initAuth = async () => {
      try {
        console.log('Initializing auth...');

        const hasAuthError = checkForAuthError();
        if (hasAuthError) {
          console.log('Auth error detected in URL, clearing session');
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);

          // Clear URL parameters if PKCE exchange failed
          const params = new URLSearchParams(window.location.search);
          if (params.has('code')) {
            console.log('Clearing failed auth code from URL');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
        console.log('Initial session:', session?.user?.email || 'No user');
        setSession(session);
        setUser(session?.user ?? null);
      } catch (err) {
        console.error('Error in initAuth:', err);

        // Clear URL parameters on any auth error
        const params = new URLSearchParams(window.location.search);
        if (params.has('code')) {
          console.log('Clearing auth code from URL after error');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } finally {
        console.log('Auth initialization complete, setting loading to false');
        setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user?.email || 'No user');

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        (async () => {
          try {
            const { data: existingStaff, error: fetchError } = await supabase
              .from('staff')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (fetchError) {
              console.error('Error fetching staff (non-blocking):', fetchError);
              return;
            }

            if (!existingStaff) {
              console.log('Creating staff record for:', session.user.email);
              const { error: insertError } = await supabase.from('staff').insert({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.user_metadata.full_name || session.user.email!.split('@')[0],
                avatar_url: session.user.user_metadata.avatar_url,
              });

              if (insertError) {
                console.error('Error inserting staff (non-blocking):', insertError);
                if (insertError.code === '23505') {
                  console.log('Staff record already exists (duplicate key error), continuing...');
                }
              }
            }
          } catch (err) {
            console.error('Error managing staff record (non-blocking):', err);
          }
        })();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log('Attempting to sign in with:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('Sign in result:', {
      user: data?.user?.email || 'No user',
      session: data?.session ? 'Session exists' : 'No session',
      error: error?.message || 'No error'
    });
    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    if (error) throw error;

    if (data.user) {
      await supabase.from('staff').insert({
        id: data.user.id,
        email: data.user.email!,
        full_name: fullName,
      });
    }
  };

  const signOut = async () => {
    console.log('Signing out user:', user?.email);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
    console.log('Sign out successful');
    setUser(null);
    setSession(null);
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
