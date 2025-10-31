import { useEffect, useState } from 'react';
import { Shield, Users, X, Check, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthorizationPage } from './AuthorizationPage';

interface User {
  id: string;
  email: string;
  role?: string;
}

interface Client {
  id: string;
  name: string;
  client_number: number;
}

interface ClientPermission {
  id: string;
  client_id: string;
  user_id: string;
  can_view: boolean;
  can_edit: boolean;
  user_email?: string;
  client_name?: string;
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'client' | 'status'>('client');
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [permissions, setPermissions] = useState<ClientPermission[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [canView, setCanView] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [staffRes, clientsRes, permissionsRes] = await Promise.all([
      supabase.from('staff').select('id, email, full_name'),
      supabase.from('clients').select('id, name, client_number').order('client_number'),
      supabase.from('client_permissions').select('*'),
    ]);

    if (staffRes.data) {
      const rolesRes = await supabase.from('user_roles').select('user_id, role');
      const rolesMap = new Map(rolesRes.data?.map(r => [r.user_id, r.role]) || []);

      setUsers(staffRes.data.map(s => ({
        id: s.id,
        email: s.email,
        role: rolesMap.get(s.id) || 'user'
      })));
    }

    if (clientsRes.data) setClients(clientsRes.data);
    if (permissionsRes.data) {
      const permsWithDetails = permissionsRes.data.map(p => {
        const user = users.find(u => u.id === p.user_id);
        const client = clientsRes.data?.find(c => c.id === p.client_id);
        return {
          ...p,
          user_email: user?.email,
          client_name: client?.name
        };
      });
      setPermissions(permsWithDetails);
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

  async function grantPermission() {
    if (!selectedUser || !selectedClient) {
      alert('Please select both a user and a client');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('client_permissions')
      .upsert({
        client_id: selectedClient,
        user_id: selectedUser,
        can_view: canView,
        can_edit: canEdit,
        granted_by: (await supabase.auth.getUser()).data.user?.id
      });

    if (error) {
      alert('Error granting permission: ' + error.message);
    } else {
      setSelectedUser('');
      setSelectedClient('');
      setCanView(true);
      setCanEdit(false);
      await loadData();
    }
    setLoading(false);
  }

  async function revokePermission(permissionId: string) {
    setLoading(true);
    const { error } = await supabase
      .from('client_permissions')
      .delete()
      .eq('id', permissionId);

    if (error) {
      alert('Error revoking permission: ' + error.message);
    } else {
      await loadData();
    }
    setLoading(false);
  }

  if (activeTab === 'status') {
    return <AuthorizationPage onBack={() => setActiveTab('client')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-red-600" />
            <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
          </div>
          <p className="text-slate-600">Manage user roles and permissions</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('client')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'client'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            Client Permissions
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'status'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Lock className="w-4 h-4" />
            Status Authorization
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Grant Client Access</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">User</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a user...</option>
                  {users.filter(u => u.role !== 'admin').map(user => (
                    <option key={user.id} value={user.id}>{user.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a client...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      #{String(client.client_number).padStart(4, '0')} - {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={canView}
                    onChange={(e) => setCanView(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Can View</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={canEdit}
                    onChange={(e) => setCanEdit(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Can Edit</span>
                </label>
              </div>

              <button
                onClick={grantPermission}
                disabled={loading || !selectedUser || !selectedClient}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Grant Permission
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Active Permissions</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">View</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Edit</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {permissions.map(perm => (
                  <tr key={perm.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {users.find(u => u.id === perm.user_id)?.email || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {clients.find(c => c.id === perm.client_id)?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {perm.can_view ? (
                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {perm.can_edit ? (
                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => revokePermission(perm.id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50 font-medium text-sm"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {permissions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-500">No permissions granted yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
