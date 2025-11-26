import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clear stale auth codes before app initialization
const params = new URLSearchParams(window.location.search);
if (params.has('code')) {
  const hasStoredSession = localStorage.getItem('supabase.auth.token');
  if (!hasStoredSession) {
    console.log('Clearing stale auth code from URL');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
