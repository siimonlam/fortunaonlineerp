import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, Instagram, Check, AlertCircle } from 'lucide-react';

export default function InstagramSettingsPage() {
  const [systemUserId, setSystemUserId] = useState('');
  const [systemUserToken, setSystemUserToken] = useState('');
  const [instagramAccountIds, setInstagramAccountIds] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

      for (const accountId of accountIds) {
        const testUrl = `https://graph.facebook.com/v21.0/${accountId}?fields=id,username,name&access_token=${systemUserToken.trim()}`;
        const response = await fetch(testUrl);

        if (response.ok) {
          const data = await response.json();
          successCount++;
          accountNames.push(`@${data.username}`);
        }
      }

      if (successCount === 0) {
        throw new Error('Could not access any Instagram accounts. Check your token permissions and account IDs.');
      }

      setMessage({
        type: 'success',
        text: `Connection successful! Found ${successCount} Instagram account(s): ${accountNames.join(', ')}. Remember to save the settings.`
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
            <h3 className="font-semibold text-blue-900 mb-2">How to get these credentials:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Go to <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="underline">Facebook Business Manager → System Users</a></li>
              <li>Create or select a System User and assign Instagram accounts to it</li>
              <li>Generate a token with permissions: <strong>instagram_basic, instagram_manage_insights</strong></li>
              <li>Copy the Access Token below</li>
              <li>Go to <a href="https://business.facebook.com/settings/instagram-accounts" target="_blank" rel="noopener noreferrer" className="underline">Business Manager → Instagram Accounts</a></li>
              <li>Copy your Instagram Business Account IDs (numeric IDs shown in the list)</li>
            </ol>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instagram Business Account IDs <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={instagramAccountIds}
              onChange={(e) => setInstagramAccountIds(e.target.value)}
              placeholder="e.g., 17841400008460056, 17841400008460057, 17841400008460058"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated Instagram Business Account IDs from Business Manager
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
          <li>Enter your System User credentials above</li>
          <li>Click "Test Connection" to verify they work</li>
          <li>Click "Save Credentials" to store them</li>
          <li>Go to Instagram Accounts page and click "Quick Sync"</li>
          <li>Your Instagram Business accounts will sync automatically</li>
        </ol>
      </div>
    </div>
  );
}
