import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, UserPlus } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
}

interface Permission {
  id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
}

interface Props {
  projectTypeName: string;
  title: string;
  description: string;
}

export function ProjectTypeAuthorizationPage({ projectTypeName, title, description }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectTypeId, setProjectTypeId] = useState<string | null>(null);

  useEffect(() => {
    loadProjectType();
  }, [projectTypeName]);

  useEffect(() => {
    if (projectTypeId) {
      loadData();
    }
  }, [projectTypeId]);

  async function loadProjectType() {
    const { data, error } = await supabase
      .from('project_types')
      .select('id')
      .eq('name', projectTypeName)
      .maybeSingle();

    if (error) {
      console.error('Error loading project type:', error);
      return;
    }

    if (data) {
      setProjectTypeId(data.id);
    }
  }

  async function loadData() {
    if (!projectTypeId) return;

    const [usersRes, permsRes] = await Promise.all([
      supabase.from('staff').select('id, email, full_name').order('email'),
      supabase.from('project_type_permissions')
        .select('id, user_id')
        .eq('project_type_id', projectTypeId)
    ]);

    if (usersRes.data) {
      setUsers(usersRes.data);
    }

    if (permsRes.data) {
      const permsWithDetails = permsRes.data.map(p => {
        const user = usersRes.data?.find(u => u.id === p.user_id);
        return {
          ...p,
          user_email: user?.email,
          user_name: user?.full_name
        };
      });
      setPermissions(permsWithDetails);
    }
  }

  async function grantPermission() {
    if (!selectedUser || !projectTypeId) {
      alert('Please select a user');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('project_type_permissions')
      .insert({
        user_id: selectedUser,
        project_type_id: projectTypeId
      });

    if (error) {
      if (error.code === '23505') {
        alert('This user already has permission');
      } else {
        alert('Error granting permission: ' + error.message);
      }
    } else {
      setSelectedUser('');
      await loadData();
    }
    setLoading(false);
  }

  async function revokePermission(permissionId: string) {
    if (!confirm('Are you sure you want to revoke this permission?')) {
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('project_type_permissions')
      .delete()
      .eq('id', permissionId);

    if (error) {
      alert('Error revoking permission: ' + error.message);
    } else {
      await loadData();
    }
    setLoading(false);
  }

  const usersWithoutPermission = users.filter(
    u => !permissions.some(p => p.user_id === u.id)
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-slate-600 mt-1">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-900">Grant Access</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a user...</option>
                {usersWithoutPermission.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={grantPermission}
              disabled={loading || !selectedUser}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Grant Permission
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-xl font-semibold text-slate-900 mb-6">Authorized Users</h3>

          <div className="space-y-2">
            {permissions.map(perm => (
              <div
                key={perm.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <div>
                  <div className="font-medium text-slate-900">{perm.user_name}</div>
                  <div className="text-sm text-slate-500">{perm.user_email}</div>
                </div>
                <button
                  onClick={() => revokePermission(perm.id)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700 font-medium text-sm disabled:text-slate-400"
                >
                  Revoke
                </button>
              </div>
            ))}
            {permissions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-500">No users have access yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
