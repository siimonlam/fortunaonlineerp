import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, BarChart3, Check, AlertCircle } from 'lucide-react';

export default function MetaAdsSettingsPage() {
  const [accessToken, setAccessToken] = useState('');
  const [adAccountIds, setAdAccountIds] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: tokenData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_ads_access_token')
        .maybeSingle();

      const { data: accountIdsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_ads_account_ids')
        .maybeSingle();

      if (tokenData) setAccessToken(tokenData.value);
      if (accountIdsData) setAdAccountIds(accountIdsData.value);
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
      if (!accessToken.trim() || !adAccountIds.trim()) {
        throw new Error('Access Token and Ad Account IDs are required');
      }

      const { error: tokenError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'meta_ads_access_token',
          value: accessToken.trim(),
          description: 'Meta Ads API access token'
        }, {
          onConflict: 'key'
        });

      if (tokenError) throw tokenError;

      const { error: accountIdsError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'meta_ads_account_ids',
          value: adAccountIds.trim(),
          description: 'Comma-separated Meta Ad Account IDs'
        }, {
          onConflict: 'key'
        });

      if (accountIdsError) throw accountIdsError;

      setMessage({ type: 'success', text: 'Settings saved successfully! You can now sync ad accounts.' });
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
      if (!accessToken.trim()) {
        throw new Error('Access Token is required');
      }

      const url = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,currency,account_status,timezone_name&access_token=${accessToken.trim()}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch Ad Accounts: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const accounts = data.data || [];

      if (accounts.length === 0) {
        throw new Error('No Ad Accounts found for this access token');
      }

      const accountIds = accounts.map((acc: any) => acc.id.replace('act_', ''));
      const accountDetails = accounts.map((acc: any) => `${acc.name} (${acc.id})`);

      setAdAccountIds(accountIds.join(', '));

      setMessage({
        type: 'success',
        text: `Discovered ${accounts.length} ad account(s): ${accountDetails.join(', ')}. Click "Save Settings" to store them.`
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
      if (!accessToken.trim() || !adAccountIds.trim()) {
        throw new Error('Access Token and Ad Account IDs are required');
      }

      const accountIds = adAccountIds.split(',').map(id => id.trim()).filter(id => id);
      if (accountIds.length === 0) {
        throw new Error('Please enter at least one Ad Account ID');
      }

      let successCount = 0;
      const accountNames: string[] = [];
      const errors: string[] = [];

      for (const accountId of accountIds) {
        const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
        const testUrl = `https://graph.facebook.com/v21.0/${formattedId}?fields=id,name,account_status&access_token=${accessToken.trim()}`;
        const response = await fetch(testUrl);

        if (response.ok) {
          const data = await response.json();
          successCount++;
          accountNames.push(data.name);
        } else {
          const error = await response.json();
          errors.push(`${accountId}: ${error.error?.message || 'Unknown error'}`);
        }
      }

      if (successCount === 0) {
        throw new Error(`Could not access any Ad Accounts. Errors: ${errors.join('; ')}`);
      }

      let message = `Connection successful! Found ${successCount} ad account(s): ${accountNames.join(', ')}.`;
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
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-2 rounded-lg">
          <BarChart3 className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meta Ads Settings</h1>
          <p className="text-sm text-gray-600">Configure API access for automated ad data sync</p>
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
            Meta Ads API Configuration
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions:</h3>

            <div className="mb-3">
              <h4 className="font-semibold text-blue-800 mb-1">Option 1: Auto-Discover (Recommended)</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 ml-2">
                <li>Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="underline">Facebook Graph API Explorer</a></li>
                <li>Select your app and generate a User Access Token</li>
                <li>Add permissions: <strong>ads_read, ads_management</strong></li>
                <li>Paste the Access Token below</li>
                <li>Click "Auto-Discover Accounts" to find all your ad accounts automatically</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Option 2: Manual Entry</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 ml-2">
                <li>Follow steps 1-4 above</li>
                <li>Go to <a href="https://business.facebook.com/settings/ad-accounts" target="_blank" rel="noopener noreferrer" className="underline">Business Manager → Ad Accounts</a></li>
                <li>Copy your Ad Account IDs (format: act_123456789012345 or just the numbers)</li>
                <li>Paste them below separated by commas</li>
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
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="e.g., EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Access token with ads_read and ads_management permissions
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Ad Account IDs <span className="text-red-500">*</span>
              </label>
              <button
                onClick={handleDiscoverAccounts}
                disabled={syncing || !accessToken.trim()}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Discovering...
                  </>
                ) : (
                  <>
                    <BarChart3 size={16} />
                    Auto-Discover Accounts
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              value={adAccountIds}
              onChange={(e) => setAdAccountIds(e.target.value)}
              placeholder="e.g., 123456789012345, 234567890123456, or act_123456789012345"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Click "Auto-Discover" to find all accounts, or manually paste comma-separated IDs
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleTestConnection}
              disabled={saving || !accessToken.trim() || !adAccountIds.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Settings size={18} />
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !accessToken.trim() || !adAccountIds.trim()}
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
          <li>Click "Auto-Discover Accounts" to find all ad accounts automatically</li>
          <li>Click "Save Settings" to store the configuration</li>
          <li>Go to any Marketing Project and navigate to "Meta Ad" section</li>
          <li>Link ad accounts to the project and sync campaign data</li>
        </ol>
      </div>
    </div>
  );
}
