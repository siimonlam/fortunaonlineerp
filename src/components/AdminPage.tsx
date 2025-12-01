import { useEffect, useState } from 'react';
import { Shield, Users, Check, Lock, Tag, Zap, Eye, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthorizationPage } from './AuthorizationPage';
import { LabelManagement } from './LabelManagement';
import { AutomationPage } from './AutomationPage';
import { ProjectTypeAuthorizationPage } from './ProjectTypeAuthorizationPage';

type AdminView = 'permissions' | 'funding-auth' | 'comsec-auth' | 'marketing-auth' | 'labels' | 'automation';

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

  return (
    <div>
      <div className="px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-red-600" />
            <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
          </div>
          <p className="text-slate-600">Manage user roles and permissions</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setCurrentView('permissions')}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentView === 'permissions'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            Client Permissions
          </button>
          <button
            onClick={() => setCurrentView('funding-auth')}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentView === 'funding-auth'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Lock className="w-4 h-4" />
            Funding Project Authorization
          </button>
          <button
            onClick={() => setCurrentView('comsec-auth')}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentView === 'comsec-auth'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Lock className="w-4 h-4" />
            Com Sec Authorization
          </button>
          <button
            onClick={() => setCurrentView('marketing-auth')}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentView === 'marketing-auth'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Lock className="w-4 h-4" />
            Marketing Authorization
          </button>
          <button
            onClick={() => setCurrentView('labels')}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentView === 'labels'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Tag className="w-4 h-4" />
            Labels
          </button>
          <button
            onClick={() => setCurrentView('automation')}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentView === 'automation'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Zap className="w-4 h-4" />
            Automation
          </button>
        </div>

        {currentView === 'permissions' && (
          <div className="space-y-8">
            {/* User Roles Section */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-slate-600" />
                <h2 className="text-xl font-semibold text-slate-900">User Roles</h2>
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

            {/* Grant Client Access Section */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-slate-600" />
                <h2 className="text-xl font-semibold text-slate-900">Grant Client Access</h2>
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

            {/* Grant Channel Partner Access Section */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-slate-600" />
                <h2 className="text-xl font-semibold text-slate-900">Grant Channel Partner Access</h2>
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

        {currentView === 'funding-auth' && <AuthorizationPage />}

        {currentView === 'comsec-auth' && (
          <ProjectTypeAuthorizationPage
            projectTypeName="Com Sec"
            title="Com Sec User Access Control"
            description="Grant or revoke access to the Com Sec module for users"
          />
        )}

        {currentView === 'marketing-auth' && (
          <ProjectTypeAuthorizationPage
            projectTypeName="Marketing"
            title="Marketing User Access Control"
            description="Grant or revoke access to the Marketing module for users"
          />
        )}

        {currentView === 'labels' && <LabelManagement />}

        {currentView === 'automation' && <AutomationPage />}
      </div>
    </div>
  );
}
