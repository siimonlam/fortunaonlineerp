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

    // Check for OAuth error in URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    if (error) {
      console.error('[AuthProvider] OAuth ERROR in URL:', error);
      console.error('[AuthProvider] OAuth ERROR description:', errorDescription);
    }

    console.log('=== AUTH DEBUG END ===');

    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[AuthProvider] Getting initial session...');

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
        );

        const sessionPromise = supabase.auth.getSession();

        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;

        if (error) {
          console.error('[AuthProvider] Error getting session:', error);
          console.error('[AuthProvider] Error details:', JSON.stringify(error, null, 2));
        }

        if (!mounted) return;

        console.log('[AuthProvider] Initial session result:', session?.user?.email || 'No user');
        if (session) {
          console.log('[AuthProvider] Full session object:', session);
        }
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
        console.log('[AuthProvider] Session object:', session);

        if (window.location.search.includes('code=') || window.location.hash.includes('access_token')) {
          console.log('[AuthProvider] Cleaning OAuth params from URL');
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        try {
          if (session?.user) {
            console.log('[AuthProvider] Checking for existing staff record...');
            const { data: existingStaff, error: selectError } = await supabase
              .from('staff')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (selectError) {
              console.error('[AuthProvider] Error checking staff record:', selectError);
            }

            if (!existingStaff) {
              console.log('[AuthProvider] No staff record found, creating one...');
              console.log('[AuthProvider] User metadata:', session.user.user_metadata);

              const { error: insertError } = await supabase.from('staff').insert({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.user_metadata.full_name || session.user.user_metadata.name || session.user.email!.split('@')[0],
              });

              if (insertError) {
                console.error('[AuthProvider] Error inserting staff record:', insertError);
              } else {
                console.log('[AuthProvider] Staff record created successfully');
              }
            } else {
              console.log('[AuthProvider] Staff record already exists');
            }
          }
        } catch (error) {
          console.error('[AuthProvider] Exception in staff record creation:', error);
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
    console.log('[AuthProvider] signInWithGoogle called');
    console.log('[AuthProvider] Window location origin:', window.location.origin);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[AuthProvider] Google OAuth error:', error);
        console.error('[AuthProvider] Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('[AuthProvider] OAuth data:', data);
      console.log('[AuthProvider] OAuth redirect initiated (you will be redirected to Google)');
    } catch (err) {
      console.error('[AuthProvider] Exception in signInWithGoogle:', err);
      throw err;
    }
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
