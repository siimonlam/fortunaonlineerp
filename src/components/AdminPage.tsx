import { useEffect, useState } from 'react';
import { Shield, Users, Check, Lock, Tag, Zap, Eye, CreditCard as Edit, DollarSign, Instagram, Facebook, BarChart3, Mail, MessageCircle, UserPlus, Send, X, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthorizationPage } from './AuthorizationPage';
import { LabelManagement } from './LabelManagement';
import { AutomationPage } from './AutomationPage';
import { ProjectTypeAuthorizationPage } from './ProjectTypeAuthorizationPage';
import { FinanceAuthorizationPage } from './FinanceAuthorizationPage';
import { EmailSettingsPage } from './EmailSettingsPage';
import { WhatsAppSettingsPage } from './WhatsAppSettingsPage';
import InstagramAccountsPage from './InstagramAccountsPage';
import FacebookAccountsPage from './FacebookAccountsPage';
import MetaAdsSettingsPage from './MetaAdsSettingsPage';
import { MarketingProjectPermissions } from './MarketingProjectPermissions';

type AdminView = 'permissions' | 'funding-auth' | 'comsec-auth' | 'marketing-auth' | 'marketing-projects' | 'finance-auth' | 'labels' | 'automation' | 'email' | 'whatsapp' | 'instagram' | 'facebook' | 'meta-ads' | 'invite-user';

interface User {
  id: string;
  email: string;
  role?: string;
  client_view_all?: boolean;
  client_edit_all?: boolean;
  channel_partner_view_all?: boolean;
  channel_partner_edit_all?: boolean;
}

interface UserPermission {
  user_id: string;
  email: string;
  client_view_all: boolean;
  client_edit_all: boolean;
  channel_partner_view_all: boolean;
  channel_partner_edit_all: boolean;
}

interface InviteResult {
  email: string;
  success: boolean;
  error?: string;
}

export function AdminPage() {
  const [currentView, setCurrentView] = useState<AdminView>('permissions');
  const [users, setUsers] = useState<User[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResults, setInviteResults] = useState<InviteResult[]>([]);
  const [bulkEmails, setBulkEmails] = useState('');
  const [inviteMode, setInviteMode] = useState<'single' | 'bulk'>('single');

  useEffect(() => {
    console.log('AdminPage mounted or currentView changed:', currentView);
    loadData();
  }, [currentView]);

  async function loadData() {
    console.log('Loading admin data...');
    const [staffRes, rolesRes, permsRes] = await Promise.all([
      supabase.from('staff').select('id, email, full_name'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('user_global_permissions').select('*')
    ]);

    if (staffRes.error) console.error('Staff error:', staffRes.error);
    if (rolesRes.error) console.error('Roles error:', rolesRes.error);
    if (permsRes.error) console.error('Perms error:', permsRes.error);

    console.log('Admin data loaded:', {
      staff: staffRes.data?.length,
      roles: rolesRes.data?.length,
      perms: permsRes.data?.length
    });

    if (staffRes.data) {
      const rolesMap = new Map(rolesRes.data?.map(r => [r.user_id, r.role]) || []);
      const permsMap = new Map(permsRes.data?.map(p => [p.user_id, p]) || []);

      const usersWithPerms = staffRes.data.map(s => {
        const perm = permsMap.get(s.id);
        return {
          id: s.id,
          email: s.email,
          role: rolesMap.get(s.id) || 'user',
          client_view_all: perm?.client_view_all || false,
          client_edit_all: perm?.client_edit_all || false,
          channel_partner_view_all: perm?.channel_partner_view_all || false,
          channel_partner_edit_all: perm?.channel_partner_edit_all || false,
        };
      });

      setUsers(usersWithPerms);

      const permsList: UserPermission[] = usersWithPerms.map(u => ({
        user_id: u.id,
        email: u.email,
        client_view_all: u.client_view_all || false,
        client_edit_all: u.client_edit_all || false,
        channel_partner_view_all: u.channel_partner_view_all || false,
        channel_partner_edit_all: u.channel_partner_edit_all || false,
      }));

      setUserPermissions(permsList);
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    setLoading(true);
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: newRole, updated_at: new Date().toISOString() });

    if (error) {
      alert('Error updating role: ' + error.message);
    } else {
      await loadData();
    }
    setLoading(false);
  }

  async function togglePermission(userId: string, permissionType: 'client_view_all' | 'client_edit_all' | 'channel_partner_view_all' | 'channel_partner_edit_all', currentValue: boolean) {
    setLoading(true);

    const { data: existing } = await supabase
      .from('user_global_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const updatedPermissions = {
      user_id: userId,
      client_view_all: existing?.client_view_all || false,
      client_edit_all: existing?.client_edit_all || false,
      channel_partner_view_all: existing?.channel_partner_view_all || false,
      channel_partner_edit_all: existing?.channel_partner_edit_all || false,
      [permissionType]: !currentValue,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('user_global_permissions')
      .upsert(updatedPermissions);

    if (error) {
      alert('Error updating permission: ' + error.message);
    } else {
      await loadData();
    }
    setLoading(false);
  }

  async function toggleCombinedPermission(userId: string, permissionGroup: 'client' | 'channel_partner', currentValue: boolean) {
    setLoading(true);

    const { data: existing } = await supabase
      .from('user_global_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const updatedPermissions = {
      user_id: userId,
      client_view_all: existing?.client_view_all || false,
      client_edit_all: existing?.client_edit_all || false,
      channel_partner_view_all: existing?.channel_partner_view_all || false,
      channel_partner_edit_all: existing?.channel_partner_edit_all || false,
      updated_at: new Date().toISOString()
    };

    if (permissionGroup === 'client') {
      updatedPermissions.client_view_all = !currentValue;
      updatedPermissions.client_edit_all = !currentValue;
    } else {
      updatedPermissions.channel_partner_view_all = !currentValue;
      updatedPermissions.channel_partner_edit_all = !currentValue;
    }

    const { error } = await supabase
      .from('user_global_permissions')
      .upsert(updatedPermissions);

    if (error) {
      alert('Error updating permission: ' + error.message);
    } else {
      await loadData();
    }
    setLoading(false);
  }

  async function sendInvite(email: string, fullName: string): Promise<InviteResult> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const res = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ email: email.trim(), full_name: fullName.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { email, success: false, error: data.error || 'Failed to send invite' };
    }
    return { email, success: true };
  }

  async function handleSingleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    const result = await sendInvite(inviteEmail, inviteFullName);
    setInviteResults(prev => [result, ...prev]);
    if (result.success) {
      setInviteEmail('');
      setInviteFullName('');
      await loadData();
    }
    setInviteLoading(false);
  }

  async function handleBulkInvite(e: React.FormEvent) {
    e.preventDefault();
    const emails = bulkEmails.split('\n').map(e => e.trim()).filter(e => e.includes('@'));
    if (!emails.length) return;
    setInviteLoading(true);
    const results: InviteResult[] = [];
    for (const email of emails) {
      const result = await sendInvite(email, '');
      results.push(result);
    }
    setInviteResults(prev => [...results, ...prev]);
    setBulkEmails('');
    await loadData();
    setInviteLoading(false);
  }

  const menuItems = [
    { id: 'permissions', label: 'Client Permissions', icon: Users },
    { id: 'funding-auth', label: 'Funding Authorization', icon: Lock },
    { id: 'comsec-auth', label: 'Com Sec Authorization', icon: Lock },
    { id: 'marketing-auth', label: 'Marketing Authorization', icon: Lock },
    { id: 'marketing-projects', label: 'Marketing Project Access', icon: Shield },
    { id: 'finance-auth', label: 'Finance Authorization', icon: DollarSign },
    { id: 'labels', label: 'Labels', icon: Tag },
    { id: 'automation', label: 'Automation', icon: Zap },
    { id: 'email', label: 'Email Settings', icon: Mail },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'instagram', label: 'Instagram', icon: Instagram },
    { id: 'facebook', label: 'Facebook', icon: Facebook },
    { id: 'meta-ads', label: 'Meta Ads', icon: BarChart3 },
    { id: 'invite-user', label: 'Invite Users', icon: UserPlus },
  ];

  return (
    <div className="flex h-full">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-red-600" />
            <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
          </div>
          <p className="text-sm text-slate-600">System settings</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id as AdminView)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    currentView === item.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="p-8">
          {currentView === 'permissions' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Client Permissions</h2>
                <p className="text-slate-600">Manage user roles and global permissions</p>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Users className="w-5 h-5 text-slate-600" />
                  <h3 className="text-xl font-semibold text-slate-900">User Roles</h3>
                </div>

                <div className="space-y-3">
                  {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                      <div>
                        <div className="font-medium text-slate-900">{user.email}</div>
                        <div className="text-sm text-slate-500">User ID: {user.id.slice(0, 8)}...</div>
                      </div>
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        disabled={loading}
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-slate-600" />
                  <h3 className="text-xl font-semibold text-slate-900">Grant Client Access</h3>
                </div>
                <p className="text-sm text-slate-600 mb-6">
                  Some users don't have view and edit all client access, but creators and sales persons automatically have view and edit access to their clients. No user can delete clients.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          View and Edit All
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {userPermissions.map(perm => {
                        const hasAccess = perm.client_view_all && perm.client_edit_all;
                        return (
                          <tr key={perm.user_id} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="font-medium text-slate-900">{perm.email}</div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <button
                                onClick={() => toggleCombinedPermission(perm.user_id, 'client', hasAccess)}
                                disabled={loading}
                                className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                                  hasAccess
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                <Check className={`w-5 h-5 ${hasAccess ? '' : 'opacity-30'}`} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-slate-600" />
                  <h3 className="text-xl font-semibold text-slate-900">Grant Channel Partner Access</h3>
                </div>
                <p className="text-sm text-slate-600 mb-6">
                  Some users don't have view and edit all channel partner access, but creators and sales persons automatically have view and edit access to their channel partners. No user can delete channel partners.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          View and Edit All
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {userPermissions.map(perm => {
                        const hasAccess = perm.channel_partner_view_all && perm.channel_partner_edit_all;
                        return (
                          <tr key={perm.user_id} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="font-medium text-slate-900">{perm.email}</div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <button
                                onClick={() => toggleCombinedPermission(perm.user_id, 'channel_partner', hasAccess)}
                                disabled={loading}
                                className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                                  hasAccess
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                <Check className={`w-5 h-5 ${hasAccess ? '' : 'opacity-30'}`} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {currentView === 'funding-auth' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Funding Project Authorization</h2>
                <p className="text-slate-600">Control access to funding projects</p>
              </div>
              <AuthorizationPage />
            </div>
          )}

          {currentView === 'comsec-auth' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Com Sec Authorization</h2>
                <p className="text-slate-600">Control access to Com Sec module</p>
              </div>
              <ProjectTypeAuthorizationPage
                projectTypeName="Com Sec"
                title="Com Sec User Access Control"
                description="Grant or revoke access to the Com Sec module for users"
              />
            </div>
          )}

          {currentView === 'marketing-auth' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Marketing Authorization</h2>
                <p className="text-slate-600">Control access to Marketing module</p>
              </div>
              <ProjectTypeAuthorizationPage
                projectTypeName="Marketing"
                title="Marketing User Access Control"
                description="Grant or revoke access to the Marketing module for users"
              />
            </div>
          )}

          {currentView === 'marketing-projects' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Marketing Project Permissions</h2>
                <p className="text-slate-600">Manage view and edit access for individual marketing projects</p>
              </div>
              <MarketingProjectPermissions />
            </div>
          )}

          {currentView === 'finance-auth' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Finance Authorization</h2>
                <p className="text-slate-600">Control access to finance features</p>
              </div>
              <FinanceAuthorizationPage />
            </div>
          )}

          {currentView === 'labels' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Labels</h2>
                <p className="text-slate-600">Manage project labels and tags</p>
              </div>
              <LabelManagement />
            </div>
          )}

          {currentView === 'automation' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Automation</h2>
                <p className="text-slate-600">Configure automation rules and triggers</p>
              </div>
              <AutomationPage />
            </div>
          )}

          {currentView === 'email' && <EmailSettingsPage />}

          {currentView === 'whatsapp' && <WhatsAppSettingsPage />}

          {currentView === 'instagram' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Instagram</h2>
                <p className="text-slate-600">Manage Instagram accounts and settings</p>
              </div>
              <InstagramAccountsPage />
            </div>
          )}

          {currentView === 'facebook' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Facebook</h2>
                <p className="text-slate-600">Manage Facebook pages and settings</p>
              </div>
              <FacebookAccountsPage />
            </div>
          )}

          {currentView === 'meta-ads' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Meta Ads</h2>
                <p className="text-slate-600">Configure Meta Ads API and sync ad accounts</p>
              </div>
              <MetaAdsSettingsPage />
            </div>
          )}

          {currentView === 'invite-user' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Invite Users</h2>
                <p className="text-slate-600">Send invite emails to new users. They will receive a link to set their password and access the system.</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-200">
                  <button
                    onClick={() => setInviteMode('single')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${inviteMode === 'single' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Single Invite
                  </button>
                  <button
                    onClick={() => setInviteMode('bulk')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${inviteMode === 'bulk' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Bulk Invite
                  </button>
                </div>

                <div className="p-6">
                  {inviteMode === 'single' ? (
                    <form onSubmit={handleSingleInvite} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-slate-400 font-normal">(optional)</span></label>
                        <input
                          type="text"
                          value={inviteFullName}
                          onChange={e => setInviteFullName(e.target.value)}
                          placeholder="e.g. John Smith"
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          placeholder="user@example.com"
                          required
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={inviteLoading || !inviteEmail.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        {inviteLoading ? 'Sending...' : 'Send Invite'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleBulkInvite} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Addresses <span className="text-slate-400 font-normal">(one per line)</span></label>
                        <textarea
                          value={bulkEmails}
                          onChange={e => setBulkEmails(e.target.value)}
                          placeholder={"alice@example.com\nbob@example.com\ncarol@example.com"}
                          rows={6}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          {bulkEmails.split('\n').filter(e => e.trim().includes('@')).length} valid email(s) detected
                        </p>
                      </div>
                      <button
                        type="submit"
                        disabled={inviteLoading || !bulkEmails.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        {inviteLoading ? 'Sending invites...' : 'Send All Invites'}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {inviteResults.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900">Invite Results</h3>
                    <button
                      onClick={() => setInviteResults([])}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {inviteResults.map((result, i) => (
                      <div key={i} className="flex items-center gap-3 px-6 py-3">
                        {result.success ? (
                          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{result.email}</div>
                          {result.error && <div className="text-xs text-red-600 mt-0.5">{result.error}</div>}
                          {result.success && <div className="text-xs text-green-600 mt-0.5">Invite sent successfully</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Current Users ({users.length})</h3>
                  <p className="text-sm text-slate-500 mt-0.5">All users currently in the system</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {users.map(user => (
                    <div key={user.id} className="flex items-center gap-3 px-6 py-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{user.email}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {user.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
