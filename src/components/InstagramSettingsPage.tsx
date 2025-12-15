import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, Instagram, Check, AlertCircle } from 'lucide-react';

export default function InstagramSettingsPage() {
  const [systemUserId, setSystemUserId] = useState('');
  const [systemUserToken, setSystemUserToken] = useState('');
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

      if (userIdData) setSystemUserId(userIdData.value);
      if (tokenData) setSystemUserToken(tokenData.value);
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
      if (!systemUserId.trim() || !systemUserToken.trim()) {
        throw new Error('Both System User ID and Token are required');
      }

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

      setMessage({ type: 'success', text: 'System User credentials saved successfully! You can now use Quick Sync to fetch Instagram accounts.' });
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
      if (!systemUserId.trim() || !systemUserToken.trim()) {
        throw new Error('Both System User ID and Token are required');
      }

      const testUrl = `https://graph.facebook.com/v21.0/${systemUserId.trim()}/accounts?access_token=${systemUserToken.trim()}`;
      const response = await fetch(testUrl);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to connect to Facebook API');
      }

      const data = await response.json();
      setMessage({
        type: 'success',
        text: `Connection successful! Found ${data.data?.length || 0} Facebook page(s). Remember to save the credentials.`
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
            System User Configuration
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">How to get these credentials:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Go to <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="underline">Facebook Business Manager → System Users</a></li>
              <li>Create or select a System User</li>
              <li>Assign your Facebook Pages to the System User</li>
              <li>Generate a token with permissions: pages_show_list, pages_read_engagement, business_management, instagram_basic, instagram_manage_insights</li>
              <li>Copy the System User ID and Access Token below</li>
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              System User ID
            </label>
            <input
              type="text"
              value={systemUserId}
              onChange={(e) => setSystemUserId(e.target.value)}
              placeholder="e.g., 123456789012345"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Found in Business Manager → System Users (numeric ID)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              System User Access Token
            </label>
            <textarea
              value={systemUserToken}
              onChange={(e) => setSystemUserToken(e.target.value)}
              placeholder="e.g., EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Generate from Business Manager → System Users → Generate New Token
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleTestConnection}
              disabled={saving || !systemUserId.trim() || !systemUserToken.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Settings size={18} />
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !systemUserId.trim() || !systemUserToken.trim()}
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
                  Save Credentials
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
