import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Facebook, RefreshCw, Users, Share2, ExternalLink, Calendar, Settings, X, Save, Check, AlertCircle, BarChart3 } from 'lucide-react';
import FacebookPageInsightsPage from './FacebookPageInsightsPage';

interface FacebookAccount {
  id: string;
  page_id: string;
  name: string;
  username: string;
  profile_picture_url: string;
  website: string;
  followers_count: number;
  client_number: string | null;
  last_updated: string;
  created_at: string;
}

export default function FacebookAccountsPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'insights'>('accounts');
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [accessToken, setAccessToken] = useState('');
  const [facebookPageIds, setFacebookPageIds] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingSettings, setSyncingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchAccounts();

    const subscription = supabase
      .channel('facebook_accounts_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'facebook_accounts'
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
      const { data: tokenData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'facebook_access_token')
        .maybeSingle();

      const { data: pageIdsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'facebook_page_ids')
        .maybeSingle();

      if (tokenData) setAccessToken(tokenData.value);
      if (pageIdsData) setFacebookPageIds(pageIdsData.value);
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
      if (!accessToken.trim() || !facebookPageIds.trim()) {
        throw new Error('Access Token and Facebook Page IDs are required');
      }

      const { error: tokenError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'facebook_access_token',
          value: accessToken.trim(),
          description: 'Facebook access token for page data API'
        }, {
          onConflict: 'key'
        });

      if (tokenError) throw tokenError;

      const { error: pageIdsError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'facebook_page_ids',
          value: facebookPageIds.trim(),
          description: 'Comma-separated Facebook Page IDs'
        }, {
          onConflict: 'key'
        });

      if (pageIdsError) throw pageIdsError;

      setSettingsMessage({ type: 'success', text: 'Settings saved successfully! You can now use Quick Sync to fetch Facebook pages.' });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setSettingsMessage({ type: 'error', text: err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAutoDiscoverPages = async () => {
    setSyncingSettings(true);
    setSettingsMessage(null);

    try {
      if (!accessToken.trim()) {
        throw new Error('Access Token is required');
      }

      const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${accessToken.trim()}`;
      const pagesResponse = await fetch(pagesUrl);

      if (!pagesResponse.ok) {
        const error = await pagesResponse.json();
        throw new Error(`Failed to fetch Facebook Pages: ${error.error?.message || 'Unknown error'}`);
      }

      const pagesData = await pagesResponse.json();
      const pages = pagesData.data || [];

      if (pages.length === 0) {
        throw new Error('No Facebook Pages found linked to this account');
      }

      const discoveredPageIds: string[] = [];
      const pageDetails: string[] = [];

      for (const page of pages) {
        discoveredPageIds.push(page.id);
        pageDetails.push(page.name);
      }

      setFacebookPageIds(discoveredPageIds.join(', '));

      setSettingsMessage({
        type: 'success',
        text: `Discovered ${discoveredPageIds.length} Facebook page(s): ${pageDetails.join(', ')}. Click "Save Settings" to store them.`
      });
    } catch (err: any) {
      console.error('Error discovering pages:', err);
      setSettingsMessage({ type: 'error', text: err.message });
    } finally {
      setSyncingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    setSavingSettings(true);
    setSettingsMessage(null);

    try {
      if (!accessToken.trim() || !facebookPageIds.trim()) {
        throw new Error('Access Token and Facebook Page IDs are required');
      }

      const pageIds = facebookPageIds.split(',').map(id => id.trim()).filter(id => id);
      if (pageIds.length === 0) {
        throw new Error('Please enter at least one Facebook Page ID');
      }

      let successCount = 0;
      const pageNames: string[] = [];
      const errors: string[] = [];

      for (const pageId of pageIds) {
        const testUrl = `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,username&access_token=${accessToken.trim()}`;
        const response = await fetch(testUrl);

        if (response.ok) {
          const data = await response.json();
          successCount++;
          pageNames.push(data.name || `Page ${pageId}`);
        } else {
          const error = await response.json();
          errors.push(`${pageId}: ${error.error?.message || 'Unknown error'}`);
        }
      }

      if (successCount === 0) {
        throw new Error(`Could not access any Facebook pages. Errors: ${errors.join('; ')}`);
      }

      let message = `Connection successful! Found ${successCount} Facebook page(s): ${pageNames.join(', ')}.`;
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
        .from('facebook_accounts')
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

  const handleSyncAccounts = async (token?: string) => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-facebook-accounts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accessToken: token || null }),
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

  // If showing insights tab, render the FacebookPageInsightsPage
  if (activeTab === 'insights') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Facebook className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Facebook</h3>
              <p className="text-sm text-gray-600">Manage pages and view analytics</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'accounts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Facebook size={16} />
                Pages
              </div>
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'insights'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={16} />
                Page Insights
              </div>
            </button>
          </div>
        </div>

        <FacebookPageInsightsPage />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Facebook className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Facebook</h3>
              <p className="text-sm text-gray-600">Manage pages and view analytics</p>
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
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'accounts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Facebook size={16} />
              Pages
            </div>
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'insights'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={16} />
              Page Insights
            </div>
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
          <Facebook className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Facebook pages yet</h3>
          <p className="text-gray-600 mb-4">
            Click "Quick Sync" to sync pages using your configured settings
          </p>
          <button
            onClick={handleQuickSync}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <RefreshCw size={20} />
            Quick Sync
          </button>
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
                      alt={account.name}
                      className="w-16 h-16 rounded-full border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
                      <Facebook className="text-white" size={32} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 truncate">
                      {account.name}
                    </h3>
                    <a
                      href={`https://facebook.com/${account.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {account.username}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 text-center">
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
                      <Share2 size={14} />
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {account.page_id}
                    </div>
                    <div className="text-xs text-gray-500">Page ID</div>
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
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Settings className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Facebook Settings</h2>
                  <p className="text-sm text-gray-600">Configure access token for Facebook page data sync</p>
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
                      <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline">Facebook Developers</a> and create an app</li>
                      <li>Navigate to your app settings and generate a Page Access Token</li>
                      <li>Ensure the token has permissions for <strong>pages_read_engagement, pages_show_list</strong></li>
                      <li>Paste the Access Token below and click "Auto-Discover Pages"</li>
                    </ol>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Access Token <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="e.g., EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Facebook Page Access Token with necessary permissions
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Facebook Page IDs <span className="text-red-500">*</span>
                        </label>
                        <button
                          onClick={handleAutoDiscoverPages}
                          disabled={syncingSettings || !accessToken.trim()}
                          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {syncingSettings ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              Discovering...
                            </>
                          ) : (
                            <>
                              <Facebook size={16} />
                              Auto-Discover Pages
                            </>
                          )}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={facebookPageIds}
                        onChange={(e) => setFacebookPageIds(e.target.value)}
                        placeholder="e.g., 123456789012345, 123456789012346"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Comma-separated list of Facebook Page IDs. Click "Auto-Discover Pages" to find them automatically.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleTestConnection}
                        disabled={savingSettings || !accessToken.trim() || !facebookPageIds.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Settings size={18} />
                        Test Connection
                      </button>

                      <button
                        onClick={handleSaveSettings}
                        disabled={savingSettings || !accessToken.trim() || !facebookPageIds.trim()}
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
