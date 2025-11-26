import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Clear stale auth codes BEFORE importing anything that uses Supabase
const params = new URLSearchParams(window.location.search);
if (params.has('code')) {
  const keys = Object.keys(localStorage).filter(key => key.includes('supabase.auth'));
  const hasValidSession = keys.some(key => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed?.access_token || parsed?.currentSession?.access_token;
      }
    } catch (e) {
      return false;
    }
    return false;
  });

  if (!hasValidSession) {
    console.log('Clearing stale auth code from URL');
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();
  }
}

// Import App after URL cleanup
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
