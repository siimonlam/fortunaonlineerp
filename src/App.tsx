import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ProjectBoard } from './components/ProjectBoard';
import { ClientOnboarding } from './components/ClientOnboarding';

function AppContent() {
  const { user, loading } = useAuth();

  if (window.location.pathname === '/onboarding') {
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
