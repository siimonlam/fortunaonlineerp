import { useState, useEffect } from 'react';
import { MessageCircle, Save, AlertCircle, CheckCircle, Eye, EyeOff, Users, Plus, X, Trash2, RefreshCw, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WhatsAppAccount {
  id: string;
  account_name: string;
  phone_number_id: string;
  phone_number: string;
  access_token: string;
  is_active: boolean;
  last_synced_at: string | null;
}

interface WhatsAppGroup {
  id: string;
  account_id: string;
  group_id: string;
  group_name: string;
  participants_count: number;
}

export function WhatsAppSettingsPage() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<WhatsAppAccount | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [syncingGroups, setSyncingGroups] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    account_name: '',
    phone_number_id: '',
    phone_number: '',
    access_token: '',
    is_active: true
  });

  useEffect(() => {
    loadAccounts();
    loadGroups();

    const accountsChannel = supabase
      .channel('whatsapp_accounts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_accounts' }, () => {
        loadAccounts();
      })
      .subscribe();

    const groupsChannel = supabase
      .channel('whatsapp_groups_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_groups' }, () => {
        loadGroups();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(accountsChannel);
      supabase.removeChannel(groupsChannel);
    };
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err: any) {
      console.error('Error loading WhatsApp accounts:', err);
      setMessage({ type: 'error', text: 'Failed to load accounts' });
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .order('group_name', { ascending: true });

      if (error) throw error;
      setGroups(data || []);
    } catch (err: any) {
      console.error('Error loading WhatsApp groups:', err);
    }
  };

  const openAccountModal = (account?: WhatsAppAccount) => {
    if (account) {
      setEditingAccount(account);
      setAccountForm({
        account_name: account.account_name,
        phone_number_id: account.phone_number_id,
        phone_number: account.phone_number || '',
        access_token: account.access_token,
        is_active: account.is_active
      });
    } else {
      setEditingAccount(null);
      setAccountForm({
        account_name: '',
        phone_number_id: '',
        phone_number: '',
        access_token: '',
        is_active: true
      });
    }
    setShowAccountModal(true);
    setShowToken(false);
  };

  const handleSaveAccount = async () => {
    try {
      if (!accountForm.account_name.trim() || !accountForm.phone_number_id.trim() || !accountForm.access_token.trim()) {
        throw new Error('Account name, Phone Number ID, and Access Token are required');
      }

      if (editingAccount) {
        const { error } = await supabase
          .from('whatsapp_accounts')
          .update({
            account_name: accountForm.account_name.trim(),
            phone_number_id: accountForm.phone_number_id.trim(),
            phone_number: accountForm.phone_number.trim() || null,
            access_token: accountForm.access_token.trim(),
            is_active: accountForm.is_active
          })
          .eq('id', editingAccount.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Account updated successfully!' });
      } else {
        const { error } = await supabase
          .from('whatsapp_accounts')
          .insert({
            account_name: accountForm.account_name.trim(),
            phone_number_id: accountForm.phone_number_id.trim(),
            phone_number: accountForm.phone_number.trim() || null,
            access_token: accountForm.access_token.trim(),
            is_active: accountForm.is_active
          });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Account added successfully!' });
      }

      setShowAccountModal(false);
      loadAccounts();
    } catch (err: any) {
      console.error('Error saving account:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save account' });
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account? All associated groups will also be deleted.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('whatsapp_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Account deleted successfully!' });
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setMessage({ type: 'error', text: 'Failed to delete account' });
    }
  };

  const handleSyncGroups = async (accountId: string) => {
    setSyncingGroups(accountId);
    try {
      const account = accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Account not found');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-whatsapp-groups`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ account_id: accountId })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync groups');
      }

      const result = await response.json();
      setMessage({ type: 'success', text: `Synced ${result.groups_count || 0} groups successfully!` });
      loadGroups();
    } catch (err: any) {
      console.error('Error syncing groups:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to sync groups' });
    } finally {
      setSyncingGroups(null);
    }
  };

  const getAccountGroups = (accountId: string) => {
    return groups.filter(g => g.account_id === accountId);
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
        <p className="text-slate-600">Manage WhatsApp Business accounts and groups using Meta service user credentials</p>
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

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-900">WhatsApp Accounts</h3>
          </div>
          <button
            onClick={() => openAccountModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No WhatsApp accounts configured yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div key={account.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-slate-900">{account.account_name}</h4>
                      {account.is_active ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">Inactive</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><strong>Phone:</strong> {account.phone_number || 'Not set'}</p>
                      <p><strong>Phone Number ID:</strong> {account.phone_number_id}</p>
                      {account.last_synced_at && (
                        <p><strong>Last Synced:</strong> {new Date(account.last_synced_at).toLocaleString()}</p>
                      )}
                      <p><strong>Groups:</strong> {getAccountGroups(account.id).length} configured</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSyncGroups(account.id)}
                      disabled={syncingGroups === account.id}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Sync Groups from WhatsApp"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingGroups === account.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => openAccountModal(account)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Account"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(account.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {getAccountGroups(account.id).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h5 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Groups ({getAccountGroups(account.id).length})
                    </h5>
                    <div className="space-y-2">
                      {getAccountGroups(account.id).map((group) => (
                        <div key={group.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                          <div>
                            <div className="font-medium text-slate-900">{group.group_name}</div>
                            <div className="text-xs text-slate-600">
                              {group.participants_count} participants • {group.group_id}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Setup Instructions:</h4>
        <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
          <li>Go to <a href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer" className="underline">Meta Business Manager</a></li>
          <li>Navigate to Business Settings → System Users</li>
          <li>Create a system user with WhatsApp Business permissions</li>
          <li>Generate a system user access token (permanent or long-lived)</li>
          <li>Navigate to WhatsApp → Phone Numbers to get the Phone Number ID</li>
          <li>Click "Add Account" above and paste your credentials</li>
          <li>Click "Sync Groups" to automatically fetch all WhatsApp groups</li>
        </ol>
      </div>

      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingAccount ? 'Edit WhatsApp Account' : 'Add WhatsApp Account'}
                </h3>
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    value={accountForm.account_name}
                    onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                    placeholder="e.g., Main Business Account"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone Number ID *
                  </label>
                  <input
                    type="text"
                    value={accountForm.phone_number_id}
                    onChange={(e) => setAccountForm({ ...accountForm, phone_number_id: e.target.value })}
                    placeholder="Find in WhatsApp Manager → Phone Numbers"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone Number (Display)
                  </label>
                  <input
                    type="text"
                    value={accountForm.phone_number}
                    onChange={(e) => setAccountForm({ ...accountForm, phone_number: e.target.value })}
                    placeholder="e.g., +852 1234 5678"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    System User Access Token *
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={accountForm.access_token}
                      onChange={(e) => setAccountForm({ ...accountForm, access_token: e.target.value })}
                      placeholder="System user permanent access token"
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
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={accountForm.is_active}
                    onChange={(e) => setAccountForm({ ...accountForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="is_active" className="text-sm text-slate-700">
                    Account is active
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAccount}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {editingAccount ? 'Update' : 'Add'} Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
