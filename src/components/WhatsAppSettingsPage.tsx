import { useState, useEffect } from 'react';
import { MessageCircle, Save, AlertCircle, CheckCircle, Eye, EyeOff, Users, Plus, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WhatsAppGroup {
  id: string;
  group_name: string;
  group_id: string;
}

export function WhatsAppSettingsPage() {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ group_name: '', group_id: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadSettings = async () => {
    try {
      setLoading(true);

      const { data: phoneData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'whatsapp_phone_number_id')
        .maybeSingle();

      const { data: tokenData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'whatsapp_access_token')
        .maybeSingle();

      const { data: groupsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'whatsapp_groups')
        .maybeSingle();

      if (phoneData) setPhoneNumberId(phoneData.value || '');
      if (tokenData) setAccessToken(tokenData.value || '');
      if (groupsData && groupsData.value) {
        try {
          const parsedGroups = JSON.parse(groupsData.value);
          setGroups(Array.isArray(parsedGroups) ? parsedGroups : []);
        } catch {
          setGroups([]);
        }
      }
    } catch (err: any) {
      console.error('Error loading WhatsApp settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      if (!phoneNumberId.trim() || !accessToken.trim()) {
        throw new Error('Phone Number ID and Access Token are required');
      }

      const { error: phoneError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'whatsapp_phone_number_id',
          value: phoneNumberId.trim(),
          description: 'WhatsApp Business Phone Number ID from Meta Business Manager'
        }, {
          onConflict: 'key'
        });

      if (phoneError) throw phoneError;

      const { error: tokenError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'whatsapp_access_token',
          value: accessToken.trim(),
          description: 'WhatsApp Business API Access Token from Meta Business Manager'
        }, {
          onConflict: 'key'
        });

      if (tokenError) throw tokenError;

      const { error: groupsError } = await supabase
        .from('system_settings')
        .upsert({
          key: 'whatsapp_groups',
          value: JSON.stringify(groups),
          description: 'WhatsApp Groups for broadcasting'
        }, {
          onConflict: 'key'
        });

      if (groupsError) throw groupsError;

      setMessage({ type: 'success', text: 'WhatsApp settings saved successfully!' });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const addGroup = () => {
    if (!newGroup.group_name.trim() || !newGroup.group_id.trim()) {
      setMessage({ type: 'error', text: 'Group name and ID are required' });
      return;
    }

    const group: WhatsAppGroup = {
      id: crypto.randomUUID(),
      group_name: newGroup.group_name.trim(),
      group_id: newGroup.group_id.trim()
    };

    setGroups([...groups, group]);
    setNewGroup({ group_name: '', group_id: '' });
    setShowGroupModal(false);
  };

  const removeGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">WhatsApp Business Settings</h2>
        <p className="text-slate-600">Configure WhatsApp Business API credentials and groups</p>
      </div>

      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-5 h-5 text-slate-600" />
          <h3 className="text-xl font-semibold text-slate-900">API Credentials</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Phone Number ID *
            </label>
            <input
              type="text"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Enter your WhatsApp Business Phone Number ID"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Find this in Meta Business Manager → WhatsApp → API Setup
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Access Token *
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter your WhatsApp Business Access Token"
                className="w-full px-4 py-2 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Generate a permanent access token in Meta Business Manager
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-900">WhatsApp Groups</h3>
          </div>
          <button
            onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Group
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Configure WhatsApp groups for broadcasting messages. Get the Group ID from WhatsApp Business API.
        </p>

        {groups.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No groups configured yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                <div>
                  <div className="font-semibold text-slate-900">{group.group_name}</div>
                  <div className="text-sm text-slate-600">ID: {group.group_id}</div>
                </div>
                <button
                  onClick={() => removeGroup(group.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Setup Instructions:</h4>
        <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
          <li>Go to <a href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer" className="underline">Meta Business Manager</a></li>
          <li>Navigate to WhatsApp → API Setup</li>
          <li>Copy your Phone Number ID and generate a permanent Access Token</li>
          <li>Paste the credentials above and click Save</li>
          <li>To send to groups, add group IDs obtained from WhatsApp Business API</li>
        </ol>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Add WhatsApp Group</h3>
                <button
                  onClick={() => {
                    setShowGroupModal(false);
                    setNewGroup({ group_name: '', group_id: '' });
                  }}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={newGroup.group_name}
                    onChange={(e) => setNewGroup({ ...newGroup, group_name: e.target.value })}
                    placeholder="e.g., Sales Team, Marketing Group"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Group ID *
                  </label>
                  <input
                    type="text"
                    value={newGroup.group_id}
                    onChange={(e) => setNewGroup({ ...newGroup, group_id: e.target.value })}
                    placeholder="e.g., 120363XXXXXXXX@g.us"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Get this from WhatsApp Business API
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowGroupModal(false);
                    setNewGroup({ group_name: '', group_id: '' });
                  }}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addGroup}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
