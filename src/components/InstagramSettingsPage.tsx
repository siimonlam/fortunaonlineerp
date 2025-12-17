import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, Instagram, Check, AlertCircle } from 'lucide-react';

export default function InstagramSettingsPage() {
  const [systemUserId, setSystemUserId] = useState('');
  const [systemUserToken, setSystemUserToken] = useState('');
  const [instagramAccountIds, setInstagramAccountIds] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
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
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

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

      setMessage({ type: 'success', text: 'Settings saved successfully! You can now use Quick Sync to fetch Instagram accounts.' });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscoverAccounts = async () => {
    setSyncing(true);
    setMessage(null);

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

      setMessage({
        type: 'success',
        text: `Discovered ${discoveredAccountIds.length} Instagram account(s): ${accountDetails.join(', ')}. Click "Save Settings" to store them.`
      });
    } catch (err: any) {
      console.error('Error discovering accounts:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setSaving(true);
    setMessage(null);

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

      setMessage({
        type: successCount > 0 ? 'success' : 'error',
        text: message
      });
    } catch (err: any) {
      console.error('Error testing connection:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-2 rounded-lg">
          <Instagram className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instagram Settings</h1>
          <p className="text-sm text-gray-600">Configure System User for automated Instagram sync</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <Check size={20} className="flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings size={20} />
            Instagram API Configuration
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Two ways to set up:</h3>

            <div className="mb-3">
              <h4 className="font-semibold text-blue-800 mb-1">Option 1: Auto-Discover (Recommended)</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 ml-2">
                <li>Go to <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="underline">Facebook Business Manager → System Users</a></li>
                <li>Create or select a System User and assign Instagram accounts to it</li>
                <li>Generate a token with permissions: <strong>instagram_basic, instagram_manage_insights, pages_show_list</strong></li>
                <li>Paste the Access Token below</li>
                <li>Click "Auto-Discover Accounts" and they'll be found automatically</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Option 2: Manual Entry</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 ml-2">
                <li>Follow steps 1-4 above</li>
                <li>Go to <a href="https://business.facebook.com/settings/instagram-accounts" target="_blank" rel="noopener noreferrer" className="underline">Business Manager → Instagram Accounts</a></li>
                <li>Manually copy Instagram Business Account IDs and paste them below</li>
              </ol>
            </div>
          </div>
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
                disabled={syncing || !systemUserToken.trim()}
                className="flex items-center gap-2 px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Discovering...
                  </>
                ) : (
                  <>
                    <Instagram size={16} />
                    Auto-Discover Accounts
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              value={instagramAccountIds}
              onChange={(e) => setInstagramAccountIds(e.target.value)}
              placeholder="e.g., 17841400008460056, 17841400008460057, 17841400008460058"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Click "Auto-Discover" to find all accounts, or manually paste comma-separated IDs
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
              For reference only - not used for API calls
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleTestConnection}
              disabled={saving || !systemUserToken.trim() || !instagramAccountIds.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Settings size={18} />
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !systemUserToken.trim() || !instagramAccountIds.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
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
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Next Steps:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>Paste your Access Token above</li>
          <li>Click "Auto-Discover Accounts" to find all Instagram accounts automatically</li>
          <li>Click "Save Settings" to store the configuration</li>
          <li>Go to Instagram Accounts page and click "Quick Sync"</li>
          <li>On any Marketing Project detail page, you can select which Instagram account to link</li>
        </ol>
      </div>
    </div>
  );
}
