import { useEffect, useState } from 'react';
import { Mail, Save, AlertCircle, CheckCircle, Eye, EyeOff, Plus, Trash2, Edit2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface EmailAccount {
  id: string;
  account_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  is_active: boolean;
  user_id: string;
  created_at: string;
}

export function EmailSettingsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [formData, setFormData] = useState({
    account_name: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: true,
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: 'Your Company',
    is_active: true,
  });

  useEffect(() => {
    loadAccounts();

    const channel = supabase
      .channel('email_accounts_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_accounts'
      }, () => {
        loadAccounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user?.id)
        .order('account_name', { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error loading email accounts:', err);
      setMessage({ type: 'error', text: 'Failed to load email accounts' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      account_name: '',
      smtp_host: '',
      smtp_port: 587,
      smtp_secure: true,
      smtp_user: '',
      smtp_password: '',
      smtp_from_email: '',
      smtp_from_name: 'Your Company',
      is_active: true,
    });
    setEditingAccount(null);
    setShowModal(false);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (account: EmailAccount) => {
    setEditingAccount(account);
    setFormData({
      account_name: account.account_name,
      smtp_host: account.smtp_host,
      smtp_port: account.smtp_port,
      smtp_secure: account.smtp_secure,
      smtp_user: account.smtp_user,
      smtp_password: account.smtp_password,
      smtp_from_email: account.smtp_from_email,
      smtp_from_name: account.smtp_from_name,
      is_active: account.is_active,
    });
    setShowModal(true);
  };

  const saveAccount = async () => {
    try {
      setSaving(true);
      setMessage(null);

      if (!formData.account_name || !formData.smtp_host || !formData.smtp_user || !formData.smtp_password || !formData.smtp_from_email) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        return;
      }

      if (editingAccount) {
        const { error } = await supabase
          .from('email_accounts')
          .update({
            account_name: formData.account_name,
            smtp_host: formData.smtp_host,
            smtp_port: formData.smtp_port,
            smtp_secure: formData.smtp_secure,
            smtp_user: formData.smtp_user,
            smtp_password: formData.smtp_password,
            smtp_from_email: formData.smtp_from_email,
            smtp_from_name: formData.smtp_from_name,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAccount.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Email account updated successfully!' });
      } else {
        const { error } = await supabase
          .from('email_accounts')
          .insert({
            ...formData,
            created_by: user?.id,
          });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Email account created successfully!' });
      }

      resetForm();
      loadAccounts();
    } catch (err: any) {
      console.error('Error saving email account:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save email account' });
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this email account? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Email account deleted successfully!' });
      loadAccounts();
    } catch (err: any) {
      console.error('Error deleting email account:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to delete email account' });
    }
  };


  const toggleActive = async (accountId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .update({ is_active: !isActive })
        .eq('id', accountId);

      if (error) throw error;
      loadAccounts();
    } catch (err: any) {
      console.error('Error updating account status:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to update account status' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">My Email Accounts (SMTP)</h2>
          <p className="text-slate-600">Manage your SMTP accounts for sending scheduled emails</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {message && (
        <div className={`rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </p>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <Mail className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <p className="text-slate-700 font-medium mb-2">No email accounts configured</p>
          <p className="text-slate-600 text-sm mb-4">
            Add an email account to enable scheduled email functionality
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Your First Account
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map(account => (
            <div key={account.id} className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-slate-900">{account.account_name}</h3>
                    {!account.is_active && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">From:</span>{' '}
                      <span className="text-slate-700 font-medium">{account.smtp_from_name} &lt;{account.smtp_from_email}&gt;</span>
                    </div>
                    <div>
                      <span className="text-slate-500">SMTP Host:</span>{' '}
                      <span className="text-slate-700">{account.smtp_host}:{account.smtp_port}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Username:</span>{' '}
                      <span className="text-slate-700">{account.smtp_user}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Security:</span>{' '}
                      <span className="text-slate-700">{account.smtp_secure ? 'TLS/SSL Enabled' : 'No Encryption'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(account.id, account.is_active)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      account.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {account.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => openEditModal(account)}
                    className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteAccount(account.id)}
                    className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingAccount ? 'Edit Email Account' : 'Add Email Account'}
                </h3>
                <button
                  onClick={resetForm}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Common SMTP Providers</p>
                    <ul className="space-y-1 text-blue-700 list-disc list-inside">
                      <li><strong>Gmail:</strong> smtp.gmail.com (port 587, TLS enabled)</li>
                      <li><strong>Outlook:</strong> smtp-mail.outlook.com (port 587, TLS enabled)</li>
                      <li><strong>SendGrid:</strong> smtp.sendgrid.net (port 587, TLS enabled)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    placeholder="e.g., Marketing Team Gmail"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">A descriptive name for this account</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      SMTP Host <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.smtp_host}
                      onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      SMTP Port <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.smtp_port}
                      onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) || 587 })}
                      placeholder="587"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Use TLS/SSL
                  </label>
                  <select
                    value={formData.smtp_secure ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, smtp_secure: e.target.value === 'true' })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="true">Yes (Recommended)</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      SMTP Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.smtp_user}
                      onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                      placeholder="your-email@gmail.com"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      SMTP Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword.modal ? 'text' : 'password'}
                        value={formData.smtp_password}
                        onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword({ ...showPassword, modal: !showPassword.modal })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword.modal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      From Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.smtp_from_email}
                      onChange={(e) => setFormData({ ...formData, smtp_from_email: e.target.value })}
                      placeholder="noreply@yourcompany.com"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={formData.smtp_from_name}
                      onChange={(e) => setFormData({ ...formData, smtp_from_name: e.target.value })}
                      placeholder="Your Company"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Active</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAccount}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : editingAccount ? 'Update Account' : 'Create Account'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
