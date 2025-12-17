import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Instagram, RefreshCw, Users, Image, ExternalLink, Calendar, Settings, X, Save, Check, AlertCircle } from 'lucide-react';

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
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [systemUserId, setSystemUserId] = useState('');
  const [systemUserToken, setSystemUserToken] = useState('');
  const [instagramAccountIds, setInstagramAccountIds] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingSettings, setSyncingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

  useEffect(() => {
    if (showSettingsModal) {
      fetchSettings();
    }
  }, [showSettingsModal]);

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const { data: userIdData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_system_user_id')
        .maybeSingle();

      const { data: tokenData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_system_user_token')
        .maybeSingle();

      const { data: accountIdsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'instagram_account_ids')
        .maybeSingle();

      if (userIdData) setSystemUserId(userIdData.value);
      if (tokenData) setSystemUserToken(tokenData.value);
      if (accountIdsData) setInstagramAccountIds(accountIdsData.value);
    } catch (err: any) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMessage(null);

    try {
      if (!systemUserToken.trim() || !instagramAccountIds.trim()) {
        throw new Error('Access Token and Instagram Account IDs are required');
      }

      if (systemUserId.trim()) {
        const { error: userIdError } = await supabase
          .from('system_settings')
          .upsert({
            key: 'meta_system_user_id',
            value: systemUserId.trim(),
            description: 'Meta System User ID for Instagram API'
          }, {
            onConflict: 'key'
          });
        if (userIdError) throw userIdError;
      }

      const { error: tokenError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'meta_system_user_token',
          value: systemUserToken.trim(),
          description: 'Meta System User access token for Instagram API'
        }, {
          onConflict: 'key'
        });

      if (tokenError) throw tokenError;

      const { error: accountIdsError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'instagram_account_ids',
          value: instagramAccountIds.trim(),
          description: 'Comma-separated Instagram Business Account IDs'
        }, {
          onConflict: 'key'
        });

      if (accountIdsError) throw accountIdsError;

      setSettingsMessage({ type: 'success', text: 'Settings saved successfully! You can now use Quick Sync to fetch Instagram accounts.' });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setSettingsMessage({ type: 'error', text: err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDiscoverAccounts = async () => {
    setSyncingSettings(true);
    setSettingsMessage(null);

    try {
      if (!systemUserToken.trim()) {
        throw new Error('Access Token is required');
      }

      const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${systemUserToken.trim()}`;
      const pagesResponse = await fetch(pagesUrl);

      if (!pagesResponse.ok) {
        const error = await pagesResponse.json();
        throw new Error(`Failed to fetch Facebook Pages: ${error.error?.message || 'Unknown error'}`);
      }

      const pagesData = await pagesResponse.json();
      const pages = pagesData.data || [];

      const discoveredAccountIds: string[] = [];
      const accountDetails: string[] = [];

      for (const page of pages) {
        if (page.instagram_business_account?.id) {
          const igId = page.instagram_business_account.id;
          discoveredAccountIds.push(igId);

          const igUrl = `https://graph.facebook.com/v21.0/${igId}?fields=username&access_token=${systemUserToken.trim()}`;
          const igResponse = await fetch(igUrl);

          if (igResponse.ok) {
            const igData = await igResponse.json();
            accountDetails.push(`@${igData.username} (Page: ${page.name})`);
          } else {
            accountDetails.push(`${igId} (Page: ${page.name})`);
          }
        }
      }

      if (discoveredAccountIds.length === 0) {
        throw new Error('No Instagram Business Accounts found linked to your Facebook Pages');
      }

      setInstagramAccountIds(discoveredAccountIds.join(', '));

      setSettingsMessage({
        type: 'success',
        text: `Discovered ${discoveredAccountIds.length} Instagram account(s): ${accountDetails.join(', ')}. Click "Save Settings" to store them.`
      });
    } catch (err: any) {
      console.error('Error discovering accounts:', err);
      setSettingsMessage({ type: 'error', text: err.message });
    } finally {
      setSyncingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    setSavingSettings(true);
    setSettingsMessage(null);

    try {
      if (!systemUserToken.trim() || !instagramAccountIds.trim()) {
        throw new Error('Access Token and Instagram Account IDs are required');
      }

      const accountIds = instagramAccountIds.split(',').map(id => id.trim()).filter(id => id);
      if (accountIds.length === 0) {
        throw new Error('Please enter at least one Instagram Account ID');
      }

      let successCount = 0;
      const accountNames: string[] = [];
      const errors: string[] = [];

      for (const accountId of accountIds) {
        const testUrl = `https://graph.facebook.com/v21.0/${accountId}?fields=id,username,name&access_token=${systemUserToken.trim()}`;
        const response = await fetch(testUrl);

        if (response.ok) {
          const data = await response.json();
          successCount++;
          accountNames.push(`@${data.username}`);
        } else {
          const error = await response.json();
          errors.push(`${accountId}: ${error.error?.message || 'Unknown error'}`);
        }
      }

      if (successCount === 0) {
        throw new Error(`Could not access any Instagram accounts. Errors: ${errors.join('; ')}`);
      }

      let message = `Connection successful! Found ${successCount} Instagram account(s): ${accountNames.join(', ')}.`;
      if (errors.length > 0) {
        message += ` Failed: ${errors.join('; ')}`;
      }
      message += ' Remember to save the settings.';

      setSettingsMessage({
        type: successCount > 0 ? 'success' : 'error',
        text: message
      });
    } catch (err: any) {
      console.error('Error testing connection:', err);
      setSettingsMessage({ type: 'error', text: err.message });
    } finally {
      setSavingSettings(false);
    }
  };

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

    const scope = 'pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_manage_insights';
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
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-2 rounded-lg">
            <Instagram className="text-white" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Instagram Accounts</h3>
            <p className="text-sm text-gray-600">Manage and sync Instagram Business accounts</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Settings size={18} />
            Settings
          </button>

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
            Add Account
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

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-2 rounded-lg">
                  <Settings className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Instagram Settings</h2>
                  <p className="text-sm text-gray-600">Configure System User for automated Instagram sync</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {settingsMessage && (
                <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
                  settingsMessage.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {settingsMessage.type === 'success' ? (
                    <Check size={20} className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm">{settingsMessage.text}</p>
                </div>
              )}

              {loadingSettings ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 ml-2">
                      <li>Go to <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="underline">Facebook Business Manager → System Users</a></li>
                      <li>Create or select a System User and assign Instagram accounts to it</li>
                      <li>Generate a token with permissions: <strong>instagram_basic, instagram_manage_insights, pages_show_list</strong></li>
                      <li>Paste the Access Token below and click "Auto-Discover Accounts"</li>
                    </ol>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Access Token <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={systemUserToken}
                        onChange={(e) => setSystemUserToken(e.target.value)}
                        placeholder="e.g., EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        System User token with Instagram permissions
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Instagram Business Account IDs <span className="text-red-500">*</span>
                        </label>
                        <button
                          onClick={handleDiscoverAccounts}
                          disabled={syncingSettings || !systemUserToken.trim()}
                          className="flex items-center gap-2 px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {syncingSettings ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              Discovering...
                            </>
                          ) : (
                            <>
                              <Instagram size={16} />
                              Auto-Discover
                            </>
                          )}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={instagramAccountIds}
                        onChange={(e) => setInstagramAccountIds(e.target.value)}
                        placeholder="e.g., 17841400008460056, 17841400008460057"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Click "Auto-Discover" to find all accounts automatically
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        System User ID <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={systemUserId}
                        onChange={(e) => setSystemUserId(e.target.value)}
                        placeholder="e.g., 123456789012345"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        For reference only
                      </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleTestConnection}
                        disabled={savingSettings || !systemUserToken.trim() || !instagramAccountIds.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Settings size={18} />
                        Test Connection
                      </button>

                      <button
                        onClick={handleSaveSettings}
                        disabled={savingSettings || !systemUserToken.trim() || !instagramAccountIds.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {savingSettings ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={18} />
                            Save Settings
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
