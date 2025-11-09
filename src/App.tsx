import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ProjectBoard } from './components/ProjectBoard';
import { ClientOnboarding } from './components/ClientOnboarding';
import { ClientAuthPage } from './components/ClientAuthPage';
import { supabase } from './lib/supabase';

function AppContent() {
  const { user, loading } = useAuth();
  const [clientAuthenticated, setClientAuthenticated] = useState(false);
  const [checkingClientAuth, setCheckingClientAuth] = useState(false);
  const isOnboardingPage = window.location.pathname === '/onboarding';

  useEffect(() => {
    if (isOnboardingPage && user) {
      checkClientAccess();
    }
  }, [user, isOnboardingPage]);

  const checkClientAccess = async () => {
    if (!user) {
      setCheckingClientAuth(false);
      return;
    }

    setCheckingClientAuth(true);
    try {
      const { data, error } = await supabase
        .from('funding_clients')
        .select('is_approved')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data && data.is_approved) {
        setClientAuthenticated(true);
      }
    } catch (err) {
      console.error('Error checking client access:', err);
    } finally {
      setCheckingClientAuth(false);
    }
  };

  if (window.location.pathname === '/onboarding') {
    if (checkingClientAuth) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="animate-pulse text-slate-600">Loading...</div>
        </div>
      );
    }

    if (!clientAuthenticated) {
      return <ClientAuthPage onAuthenticated={() => setClientAuthenticated(true)} />;
    }

    return <ClientOnboarding />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading...</div>
      </div>
    );
  }

  return user ? <ProjectBoard /> : <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
