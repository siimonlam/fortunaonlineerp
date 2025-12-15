import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ProjectBoard } from './components/ProjectBoard';
import { ClientOnboarding } from './components/ClientOnboarding';
import { ClientAuthPage } from './components/ClientAuthPage';
import { PhoneScanPage } from './components/PhoneScanPage';
import { InstagramCallback } from './components/InstagramCallback';
import { TaskDueSummaryModal } from './components/TaskDueSummaryModal';
import { supabase } from './lib/supabase';

function AppContent() {
  const { user, loading } = useAuth();
  const [clientAuthenticated, setClientAuthenticated] = useState(false);
  const [checkingClientAuth, setCheckingClientAuth] = useState(true);
  const [showForceLoad, setShowForceLoad] = useState(false);
  const [showTaskSummary, setShowTaskSummary] = useState(false);

  console.log('[AppContent] Render - loading:', loading, '| user:', user?.email || 'null', '| pathname:', window.location.pathname);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn('[AppContent] Still loading after 5 seconds, showing force load button');
        setShowForceLoad(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (window.location.pathname === '/onboarding' && user) {
      checkClientAccess();
    } else {
      setCheckingClientAuth(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && !loading && window.location.pathname !== '/onboarding' && window.location.pathname !== '/phone-scan') {
      const taskSummaryShown = sessionStorage.getItem('taskSummaryShown');
      if (!taskSummaryShown) {
        const timer = setTimeout(() => {
          setShowTaskSummary(true);
          sessionStorage.setItem('taskSummaryShown', 'true');
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, loading]);

  useEffect(() => {
    const handlePendingInstagramAuth = async () => {
      if (!user || loading) return;

      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get('redirect');
      const pendingToken = localStorage.getItem('instagram_pending_token');

      if (redirect === 'instagram' && pendingToken) {
        console.log('[App] Processing pending Instagram authentication');

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-instagram-accounts`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ accessToken: pendingToken }),
            }
          );

          const result = await response.json();

          if (response.ok) {
            console.log('[App] Instagram sync successful:', result);
            localStorage.removeItem('instagram_pending_token');
            window.history.replaceState({}, document.title, '/#instagram');
            window.location.hash = '#instagram';
          } else {
            console.error('[App] Instagram sync failed:', result);
            localStorage.removeItem('instagram_pending_token');
          }
        } catch (err) {
          console.error('[App] Error processing pending Instagram auth:', err);
          localStorage.removeItem('instagram_pending_token');
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handlePendingInstagramAuth();
  }, [user, loading]);

  const checkClientAccess = async () => {
    if (!user) {
      setCheckingClientAuth(false);
      return;
    }

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

  if (window.location.pathname === '/phone-scan') {
    return <PhoneScanPage />;
  }

  if (window.location.pathname === '/instagram-callback') {
    return <InstagramCallback />;
  }

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
        <div className="flex flex-col items-center gap-4">
          <div className="animate-pulse text-slate-600">Loading...</div>
          {showForceLoad && (
            <div className="text-center">
              <p className="text-sm text-slate-500 mb-2">Taking longer than expected...</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Force Reload
              </button>
              <p className="text-xs text-slate-400 mt-2">Check console for errors (F12)</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {user ? <ProjectBoard /> : <LoginPage />}
      {showTaskSummary && user && (
        <TaskDueSummaryModal
          userId={user.id}
          onClose={() => setShowTaskSummary(false)}
        />
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
