import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, Users, DollarSign } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface UserWithAccess extends User {
  hasAccess: boolean;
  permissionId?: string;
}

export function FinanceAuthorizationPage() {
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [usersRes, permsRes] = await Promise.all([
      supabase.from('staff').select('id, email, full_name, role').order('full_name'),
      supabase.from('finance_permissions').select('id, user_id')
    ]);

    if (usersRes.data) {
      const usersWithAccess: UserWithAccess[] = usersRes.data.map(user => {
        const permission = permsRes.data?.find(p => p.user_id === user.id);
        return {
          ...user,
          hasAccess: !!permission,
          permissionId: permission?.id
        };
      });
      setUsers(usersWithAccess);
    }
  }

  async function toggleAccess(user: UserWithAccess) {
    setLoading(true);

    if (user.hasAccess && user.permissionId) {
      const { error } = await supabase
        .from('finance_permissions')
        .delete()
        .eq('id', user.permissionId);

      if (error) {
        alert('Error revoking access: ' + error.message);
      } else {
        await loadData();
      }
    } else {
      const { error } = await supabase
        .from('finance_permissions')
        .insert({
          user_id: user.id
        });

      if (error) {
        alert('Error granting access: ' + error.message);
      } else {
        await loadData();
      }
    }

    setLoading(false);
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-8 h-8 text-green-600" />
          <h2 className="text-2xl font-bold text-slate-900">Finance Authorization</h2>
        </div>
        <p className="text-slate-600 mt-1">
          Control which users can access invoice actions (Mark Paid, Void, Delete).
          Admin users always have full access to these features.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-900">User Access Control</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Toggle access for each user. Users with Finance permission can manage invoices including marking them as paid, voiding them, or deleting them.
          </p>
        </div>

        <div className="divide-y divide-slate-200">
          {users.map(user => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1">
                <div className="font-medium text-slate-900">{user.full_name}</div>
                <div className="text-sm text-slate-500">{user.email}</div>
              </div>

              {user.role === 'admin' ? (
                <div className="px-4 py-2 rounded-lg font-medium text-sm bg-green-100 text-green-700">
                  Admin - Always Has Access
                </div>
              ) : (
                <button
                  onClick={() => toggleAccess(user)}
                  disabled={loading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    user.hasAccess
                      ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {user.hasAccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      Has Access
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      No Access
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500">No users found</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Total Users:</span>
            <span className="font-semibold text-slate-900">{users.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-600">Users with Finance Access:</span>
            <span className="font-semibold text-green-700">
              {users.filter(u => u.hasAccess).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
