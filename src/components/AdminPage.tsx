import { useEffect, useState } from 'react';
import { Shield, Users, Check, Lock, Tag, Zap, Eye, Edit, DollarSign, Instagram, Facebook, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthorizationPage } from './AuthorizationPage';
import { LabelManagement } from './LabelManagement';
import { AutomationPage } from './AutomationPage';
import { ProjectTypeAuthorizationPage } from './ProjectTypeAuthorizationPage';
import { FinanceAuthorizationPage } from './FinanceAuthorizationPage';
import InstagramAccountsPage from './InstagramAccountsPage';
import FacebookAccountsPage from './FacebookAccountsPage';
import MetaAdsSettingsPage from './MetaAdsSettingsPage';

type AdminView = 'permissions' | 'funding-auth' | 'comsec-auth' | 'marketing-auth' | 'finance-auth' | 'labels' | 'automation' | 'instagram' | 'facebook' | 'meta-ads';

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

export function AdminPage() {
  const [currentView, setCurrentView] = useState<AdminView>('permissions');
  const [users, setUsers] = useState<User[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(false);

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

  const menuItems = [
    { id: 'permissions', label: 'Client Permissions', icon: Users },
    { id: 'funding-auth', label: 'Funding Authorization', icon: Lock },
    { id: 'comsec-auth', label: 'Com Sec Authorization', icon: Lock },
    { id: 'marketing-auth', label: 'Marketing Authorization', icon: Lock },
    { id: 'finance-auth', label: 'Finance Authorization', icon: DollarSign },
    { id: 'labels', label: 'Labels', icon: Tag },
    { id: 'automation', label: 'Automation', icon: Zap },
    { id: 'instagram', label: 'Instagram', icon: Instagram },
    { id: 'facebook', label: 'Facebook', icon: Facebook },
    { id: 'meta-ads', label: 'Meta Ads', icon: BarChart3 },
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
                          View All Clients
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Edit All Clients
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {userPermissions.map(perm => (
                        <tr key={perm.user_id} className="hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <div className="font-medium text-slate-900">{perm.email}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => togglePermission(perm.user_id, 'client_view_all', perm.client_view_all)}
                              disabled={loading}
                              className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                                perm.client_view_all
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              <Check className={`w-5 h-5 ${perm.client_view_all ? '' : 'opacity-30'}`} />
                            </button>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => togglePermission(perm.user_id, 'client_edit_all', perm.client_edit_all)}
                              disabled={loading}
                              className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                                perm.client_edit_all
                                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              <Edit className={`w-5 h-5 ${perm.client_edit_all ? '' : 'opacity-30'}`} />
                            </button>
                          </td>
                        </tr>
                      ))}
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
                          View All Channel Partners
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Edit All Channel Partners
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {userPermissions.map(perm => (
                        <tr key={perm.user_id} className="hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <div className="font-medium text-slate-900">{perm.email}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => togglePermission(perm.user_id, 'channel_partner_view_all', perm.channel_partner_view_all)}
                              disabled={loading}
                              className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                                perm.channel_partner_view_all
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              <Check className={`w-5 h-5 ${perm.channel_partner_view_all ? '' : 'opacity-30'}`} />
                            </button>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => togglePermission(perm.user_id, 'channel_partner_edit_all', perm.channel_partner_edit_all)}
                              disabled={loading}
                              className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                                perm.channel_partner_edit_all
                                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              <Edit className={`w-5 h-5 ${perm.channel_partner_edit_all ? '' : 'opacity-30'}`} />
                            </button>
                          </td>
                        </tr>
                      ))}
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
        </div>
      </div>
    </div>
  );
}
