import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Instagram, RefreshCw, Users, Image, ExternalLink, Calendar } from 'lucide-react';

interface InstagramAccount {
  id: string;
  account_id: string;
  username: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  website: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  client_number: string | null;
  last_updated: string;
  created_at: string;
}

export default function InstagramAccountsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();

    const subscription = supabase
      .channel('instagram_accounts_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'instagram_accounts'
      }, () => {
        fetchAccounts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('instagram_accounts')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaLogin = () => {
    const metaAppId = import.meta.env.VITE_META_APP_ID;
    const redirectUri = import.meta.env.VITE_META_REDIRECT_URI;

    if (!metaAppId) {
      setError('Meta App ID not configured. Please add VITE_META_APP_ID to .env file.');
      return;
    }

    const scope = 'pages_show_list,pages_read_engagement,business_management';
    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=token`;

    window.location.href = authUrl;
  };

  const handleSyncAccounts = async (accessToken?: string) => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-instagram-accounts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accessToken: accessToken || null }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync accounts');
      }

      setSuccessMessage(result.message);
      await fetchAccounts();
    } catch (err: any) {
      console.error('Error syncing accounts:', err);
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickSync = () => {
    handleSyncAccounts();
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');

      if (accessToken) {
        console.log('OAuth callback received with access token');
        window.history.replaceState({}, document.title, window.location.pathname);

        // Save the token first
        saveAccessToken(accessToken).then(() => {
          handleSyncAccounts(accessToken);
        });
      }
    }
  }, []);

  const saveAccessToken = async (token: string) => {
    try {
      // Save to system_settings for future syncs
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'meta_oauth_user_token',
          value: token,
          description: 'OAuth user access token for Instagram API'
        }, {
          onConflict: 'key'
        });

      if (error) {
        console.error('Error saving access token:', error);
      } else {
        console.log('Access token saved successfully');
      }
    } catch (err) {
      console.error('Error saving access token:', err);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-2 rounded-lg">
            <Instagram className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Instagram Accounts</h1>
            <p className="text-sm text-gray-600">Manage and sync Instagram Business accounts</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleQuickSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? (
              <>
                <RefreshCw className="animate-spin" size={18} />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={18} />
                Quick Sync
              </>
            )}
          </button>

          <button
            onClick={handleMetaLogin}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Instagram size={18} />
            Add Account (OAuth)
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Instagram className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Instagram accounts yet</h3>
          <p className="text-gray-600 mb-4">
            Click "Quick Sync" to sync accounts from your System User, or use OAuth to add individual accounts
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleQuickSync}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <RefreshCw size={20} />
              Quick Sync
            </button>
            <button
              onClick={handleMetaLogin}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              <Instagram size={20} />
              Connect via OAuth
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  {account.profile_picture_url ? (
                    <img
                      src={account.profile_picture_url}
                      alt={account.username}
                      className="w-16 h-16 rounded-full border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                      <Instagram className="text-white" size={32} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 truncate">
                      {account.name || account.username}
                    </h3>
                    <a
                      href={`https://instagram.com/${account.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      @{account.username}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                {account.biography && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {account.biography}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                      <Users size={14} />
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatNumber(account.followers_count)}
                    </div>
                    <div className="text-xs text-gray-500">Followers</div>
                  </div>

                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                      <Users size={14} />
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatNumber(account.follows_count)}
                    </div>
                    <div className="text-xs text-gray-500">Following</div>
                  </div>

                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                      <Image size={14} />
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatNumber(account.media_count)}
                    </div>
                    <div className="text-xs text-gray-500">Posts</div>
                  </div>
                </div>

                {account.website && (
                  <a
                    href={account.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mb-2 block truncate"
                  >
                    {account.website}
                  </a>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
                  <Calendar size={12} />
                  <span>Last synced: {formatDate(account.last_updated)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
