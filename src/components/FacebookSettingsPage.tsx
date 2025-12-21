import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, Check, AlertCircle, Facebook } from 'lucide-react';

export default function FacebookSettingsPage() {
  const [systemUserId, setSystemUserId] = useState('');
  const [systemUserToken, setSystemUserToken] = useState('');
  const [facebookPageIds, setFacebookPageIds] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [checkingToken, setCheckingToken] = useState(false);
  const [testingPermissions, setTestingPermissions] = useState(false);
  const [permissionTestResults, setPermissionTestResults] = useState<any>(null);
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');

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

      const { data: pageIdsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'facebook_page_ids')
        .maybeSingle();

      if (userIdData) setSystemUserId(userIdData.value);
      if (tokenData) setSystemUserToken(tokenData.value);
      if (pageIdsData) setFacebookPageIds(pageIdsData.value);
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
      if (!systemUserToken.trim() || !facebookPageIds.trim()) {
        throw new Error('Access Token and Facebook Page IDs are required');
      }

      if (systemUserId.trim()) {
        const { error: userIdError } = await supabase
          .from('system_settings')
          .upsert({
            key: 'meta_system_user_id',
            value: systemUserId.trim(),
            description: 'Meta System User ID for Facebook API'
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
          description: 'Meta System User access token for Facebook API'
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

      setMessage({ type: 'success', text: 'Settings saved successfully! You can now use Quick Sync to fetch Facebook pages.' });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscoverPages = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      if (!systemUserToken.trim()) {
        throw new Error('Access Token is required');
      }

      const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${systemUserToken.trim()}`;
      const pagesResponse = await fetch(pagesUrl);

      if (!pagesResponse.ok) {
        const error = await pagesResponse.json();
        throw new Error(`Failed to fetch Facebook Pages: ${error.error?.message || 'Unknown error'}`);
      }

      const pagesData = await pagesResponse.json();
      const pages = pagesData.data || [];

      if (pages.length === 0) {
        throw new Error('No Facebook Pages found linked to your account');
      }

      const discoveredPageIds: string[] = [];
      const pageDetails: string[] = [];

      for (const page of pages) {
        discoveredPageIds.push(page.id);
        pageDetails.push(page.name);
      }

      setFacebookPageIds(discoveredPageIds.join(', '));

      setMessage({
        type: 'success',
        text: `Discovered ${discoveredPageIds.length} Facebook page(s): ${pageDetails.join(', ')}. Click "Save Settings" to store them.`
      });
    } catch (err: any) {
      console.error('Error discovering pages:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckToken = async () => {
    setCheckingToken(true);
    setMessage(null);
    setTokenInfo(null);

    try {
      if (!systemUserToken.trim()) {
        throw new Error('Access Token is required');
      }

      const debugUrl = `https://graph.facebook.com/v21.0/debug_token?input_token=${systemUserToken.trim()}&access_token=${systemUserToken.trim()}`;
      const response = await fetch(debugUrl);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to check token: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      setTokenInfo(data.data);

      if (!data.data.is_valid) {
        setMessage({ type: 'error', text: 'Token is invalid or expired. Please get a new token.' });
      } else {
        const expiresAt = data.data.expires_at ? new Date(data.data.expires_at * 1000).toLocaleString() : 'Never';
        const tokenType = data.data.expires_at === 0 ? 'Long-lived (System User)' : 'Short-lived';

        setMessage({
          type: data.data.expires_at === 0 ? 'success' : 'error',
          text: `Token Type: ${tokenType} | Valid: ${data.data.is_valid ? 'Yes' : 'No'} | Expires: ${expiresAt}`
        });
      }
    } catch (err: any) {
      console.error('Error checking token:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setCheckingToken(false);
    }
  };

  const handleTestTokenPermissions = async () => {
    setTestingPermissions(true);
    setMessage(null);
    setPermissionTestResults(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-facebook-token`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });

      const data = await response.json();
      setPermissionTestResults(data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test token permissions');
      }

      const failedTests = data.tests?.filter((t: any) => t.status.includes('❌')) || [];
      if (failedTests.length > 0) {
        setMessage({
          type: 'error',
          text: `Token test completed with ${failedTests.length} failed test(s). Check details below.`
        });
      } else {
        setMessage({
          type: 'success',
          text: 'All token permission tests passed successfully!'
        });
      }
    } catch (err: any) {
      console.error('Error testing token permissions:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setTestingPermissions(false);
    }
  };

  const handleExchangeToken = async () => {
    setSaving(true);
    setMessage(null);

    try {
      if (!systemUserToken.trim() || !appId.trim() || !appSecret.trim()) {
        throw new Error('Access Token, App ID, and App Secret are required to exchange token');
      }

      const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId.trim()}&client_secret=${appSecret.trim()}&fb_exchange_token=${systemUserToken.trim()}`;

      const response = await fetch(exchangeUrl);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to exchange token: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      setSystemUserToken(data.access_token);

      setMessage({
        type: 'success',
        text: `Token exchanged successfully! This long-lived token is valid for ~60 days. Click "Save Settings" to store it.`
      });

      setTokenInfo(null);
    } catch (err: any) {
      console.error('Error exchanging token:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setSaving(true);
    setMessage(null);

    try {
      if (!systemUserToken.trim() || !facebookPageIds.trim()) {
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
        const testUrl = `https://graph.facebook.com/v21.0/${pageId}?fields=id,name&access_token=${systemUserToken.trim()}`;
        const response = await fetch(testUrl);

        if (response.ok) {
          const data = await response.json();
          successCount++;
          pageNames.push(data.name);
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
        <div className="bg-blue-600 p-2 rounded-lg">
          <Facebook className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facebook Settings</h1>
          <p className="text-sm text-gray-600">Configure System User for automated Facebook Page sync</p>
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
            Facebook API Configuration
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Two ways to set up:</h3>

            <div className="mb-3">
              <h4 className="font-semibold text-blue-800 mb-1">Option 1: Auto-Discover (Recommended)</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 ml-2">
                <li>Go to <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="underline">Facebook Business Manager → System Users</a></li>
                <li>Create or select a System User and assign Facebook Pages to it</li>
                <li>Generate a token with permissions: <strong>pages_show_list, pages_read_engagement, read_insights</strong></li>
                <li>Paste the Access Token below</li>
                <li>Click "Auto-Discover Pages" and they'll be found automatically</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Option 2: Manual Entry</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 ml-2">
                <li>Follow steps 1-4 above</li>
                <li>Go to <a href="https://business.facebook.com/settings/pages" target="_blank" rel="noopener noreferrer" className="underline">Business Manager → Pages</a></li>
                <li>Manually copy Facebook Page IDs and paste them below</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Access Token <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleCheckToken}
                  disabled={checkingToken || !systemUserToken.trim()}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {checkingToken ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      Checking...
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} />
                      Check Token
                    </>
                  )}
                </button>
                <button
                  onClick={handleTestTokenPermissions}
                  disabled={testingPermissions || !systemUserToken.trim()}
                  className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testingPermissions ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      Testing...
                    </>
                  ) : (
                    <>
                      <Settings size={16} />
                      Test Permissions
                    </>
                  )}
                </button>
              </div>
            </div>
            <textarea
              value={systemUserToken}
              onChange={(e) => setSystemUserToken(e.target.value)}
              placeholder="e.g., EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              System User token with Facebook Pages permissions
            </p>
          </div>

          {tokenInfo && tokenInfo.expires_at > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Short-lived Token Detected!</h4>
              <p className="text-sm text-yellow-800 mb-3">
                Your token expires soon. Exchange it for a long-lived token (60 days) by providing your App ID and App Secret below.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-yellow-900 mb-1">
                    App ID
                  </label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g., 1234567890"
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-yellow-900 mb-1">
                    App Secret
                  </label>
                  <input
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="e.g., abcdef1234567890"
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <button
                onClick={handleExchangeToken}
                disabled={saving || !appId.trim() || !appSecret.trim()}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Exchanging...
                  </>
                ) : (
                  'Exchange for Long-lived Token'
                )}
              </button>

              <p className="text-xs text-yellow-700 mt-2">
                Find your App ID and Secret at <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline">developers.facebook.com/apps</a>
              </p>
            </div>
          )}

          {permissionTestResults && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3">Token Permission Test Results</h4>
              <div className="space-y-2">
                <p className="text-sm text-blue-800">
                  <strong>Page:</strong> {permissionTestResults.pageName} ({permissionTestResults.pageId})
                </p>
                {permissionTestResults.tests?.map((test: any, index: number) => (
                  <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{test.test}</span>
                      <span className="text-sm">{test.status}</span>
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-32">
                      {JSON.stringify(test.response, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Facebook Page IDs <span className="text-red-500">*</span>
              </label>
              <button
                onClick={handleDiscoverPages}
                disabled={syncing || !systemUserToken.trim()}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? (
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
              placeholder="e.g., 123456789012345, 234567890123456, 345678901234567"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Click "Auto-Discover" to find all pages, or manually paste comma-separated IDs
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
              disabled={saving || !systemUserToken.trim() || !facebookPageIds.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Settings size={18} />
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !systemUserToken.trim() || !facebookPageIds.trim()}
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
          <li>Click "Auto-Discover Pages" to find all Facebook pages automatically</li>
          <li>Click "Save Settings" to store the configuration</li>
          <li>Go to Facebook Pages page and click "Quick Sync"</li>
          <li>On any Marketing Project detail page, you can select which Facebook page to link</li>
        </ol>
      </div>
    </div>
  );
}
