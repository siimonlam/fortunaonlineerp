import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Instagram } from 'lucide-react';

export function InstagramCallback() {
  const [status, setStatus] = useState('Processing Instagram connection...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const urlSearch = window.location.search;
      const hash = window.location.hash;

      console.log('[InstagramCallback] URL search:', urlSearch);
      console.log('[InstagramCallback] Hash:', hash);

      if (!hash.includes('access_token=')) {
        setStatus('No access token found. Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
        return;
      }

      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');

      console.log('[InstagramCallback] Access token found:', accessToken ? 'YES' : 'NO');

      if (!accessToken) {
        setStatus('Invalid access token. Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
        return;
      }

      setStatus('Syncing Instagram accounts...');

      const { data: { session } } = await supabase.auth.getSession();
      console.log('[InstagramCallback] Session:', session ? 'EXISTS' : 'NONE');

      if (!session) {
        console.log('[InstagramCallback] Saving token to localStorage and redirecting to login');
        localStorage.setItem('instagram_pending_token', accessToken);
        setStatus('Please log in to continue...');
        setTimeout(() => {
          window.location.href = '/?redirect=instagram';
        }, 2000);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-instagram-accounts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accessToken }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync accounts');
      }

      setStatus(`Success! Synced ${result.accounts?.length || 0} account(s). Redirecting...`);

      setTimeout(() => {
        window.location.href = '/#instagram';
      }, 2000);

    } catch (err: any) {
      console.error('Callback error:', err);
      setStatus(`Error: ${err.message}`);
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center">
          <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 rounded-full mb-4">
            <Instagram className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Instagram Connection</h2>
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p>{status}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
