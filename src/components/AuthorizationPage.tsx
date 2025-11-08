import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Users, CheckSquare, Square, Save, X, ArrowLeft, Lock } from 'lucide-react';

interface Staff {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Status {
  id: string;
  name: string;
  project_type_id: string;
  is_substatus: boolean;
  parent_status_id: string | null;
}

interface ProjectType {
  id: string;
  name: string;
}

interface StatusPermission {
  id?: string;
  user_id: string;
  status_id: string;
  can_view_all: boolean;
  can_edit_all: boolean;
}

interface StatusManager {
  id: string;
  status_id: string;
  user_id: string;
  assigned_by: string;
  staff?: Staff;
}

interface AuthorizationPageProps {
  onBack?: () => void;
}

export function AuthorizationPage({ onBack }: AuthorizationPageProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [permissions, setPermissions] = useState<StatusPermission[]>([]);
  const [statusManagers, setStatusManagers] = useState<StatusManager[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedProjectType, setSelectedProjectType] = useState<string>('');
  const [selectedStatusForManager, setSelectedStatusForManager] = useState<string>('');
  const [selectedManagerUser, setSelectedManagerUser] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, StatusPermission>>(new Map());
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [projectTypePermissions, setProjectTypePermissions] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadUserPermissions();
    }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedProjectType) {
      loadStatusManagers();
    }
  }, [selectedProjectType]);

  async function loadData() {
    try {
      const [staffData, typesData, statusesData, projectTypePermsData] = await Promise.all([
        supabase.from('staff').select('*').order('full_name'),
        supabase.from('project_types').select('*').order('name'),
        supabase.from('statuses').select('*').order('order_index'),
        supabase.from('project_type_permissions').select('user_id, project_type_id')
      ]);

      console.log('Load data results:', { staffData, typesData, statusesData, projectTypePermsData });

      if (staffData.error) {
        console.error('Staff data error:', staffData.error);
      }
      if (typesData.error) {
        console.error('Types data error:', typesData.error);
      }
      if (statusesData.error) {
        console.error('Statuses data error:', statusesData.error);
      }
      if (projectTypePermsData.error) {
        console.error('Project type perms error:', projectTypePermsData.error);
      }

      if (staffData.data) setStaff(staffData.data);
      if (typesData.data) {
        setProjectTypes(typesData.data);
        if (typesData.data.length > 0) {
          const fundingType = typesData.data.find(t => t.name === 'Funding Project');
          setSelectedProjectType(fundingType?.id || typesData.data[0].id);
        }
      }
      if (statusesData.data) setStatuses(statusesData.data);

      if (projectTypePermsData.data) {
        const permsMap = new Map<string, Set<string>>();
        projectTypePermsData.data.forEach(perm => {
          if (!permsMap.has(perm.project_type_id)) {
            permsMap.set(perm.project_type_id, new Set());
          }
          permsMap.get(perm.project_type_id)!.add(perm.user_id);
        });
        setProjectTypePermissions(permsMap);
      }
    } catch (error) {
      console.error('Critical error in loadData:', error);
      alert('Error loading authorization data: ' + (error as Error).message);
    }
  }

  async function loadUserPermissions() {
    const { data } = await supabase
      .from('status_permissions')
      .select('*')
      .eq('user_id', selectedUser);

    if (data) {
      setPermissions(data);
      setPendingChanges(new Map());
    }
  }

  async function loadStatusManagers() {
    const { data } = await supabase
      .from('status_managers')
      .select('*, staff:user_id(*)')
      .in('status_id', statuses.filter(s => s.project_type_id === selectedProjectType).map(s => s.id));

    if (data) {
      setStatusManagers(data);
    }
  }

  async function addStatusManager() {
    if (!selectedStatusForManager || !selectedManagerUser) {
      alert('Please select both a status and a user');
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('status_managers')
        .insert({
          status_id: selectedStatusForManager,
          user_id: selectedManagerUser,
          assigned_by: user.user?.id
        });

      if (error) throw error;

      setSelectedStatusForManager('');
      setSelectedManagerUser('');
      await loadStatusManagers();
      alert('Status manager added successfully');
    } catch (error: any) {
      console.error('Error adding status manager:', error);
      alert(`Failed to add status manager: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function removeStatusManager(managerId: string) {
    if (!confirm('Remove this status manager?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('status_managers')
        .delete()
        .eq('id', managerId);

      if (error) throw error;

      await loadStatusManagers();
      alert('Status manager removed successfully');
    } catch (error: any) {
      console.error('Error removing status manager:', error);
      alert('Failed to remove status manager');
    } finally {
      setLoading(false);
    }
  }

  function getPermission(statusId: string): StatusPermission {
    const pending = pendingChanges.get(statusId);
    if (pending) return pending;

    const existing = permissions.find(p => p.status_id === statusId);
    if (existing) return existing;

    return {
      user_id: selectedUser,
      status_id: statusId,
      can_view_all: false,
      can_edit_all: false
    };
  }

  function togglePermission(statusId: string, field: 'can_view_all' | 'can_edit_all') {
    const current = getPermission(statusId);
    const updated = { ...current, [field]: !current[field] };

    const newPending = new Map(pendingChanges);
    newPending.set(statusId, updated);
    setPendingChanges(newPending);
  }

  async function savePermissions() {
    if (!selectedUser || pendingChanges.size === 0) return;

    setLoading(true);
    try {
      const currentStaff = staff.find(s => s.id === selectedUser);

      for (const [statusId, permission] of pendingChanges) {
        const existing = permissions.find(p => p.status_id === statusId);

        if (permission.can_view_all || permission.can_edit_all) {
          if (existing) {
            await supabase
              .from('status_permissions')
              .update({
                can_view_all: permission.can_view_all,
                can_edit_all: permission.can_edit_all,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('status_permissions')
              .insert({
                user_id: selectedUser,
                status_id: statusId,
                can_view_all: permission.can_view_all,
                can_edit_all: permission.can_edit_all,
                created_by: currentStaff?.id
              });
          }
        } else if (existing) {
          await supabase
            .from('status_permissions')
            .delete()
            .eq('id', existing.id);
        }
      }

      await loadUserPermissions();
      alert('Permissions saved successfully');
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Failed to save permissions');
    } finally {
      setLoading(false);
    }
  }

  async function toggleProjectTypeAccess(userId: string, projectTypeId: string) {
    setLoading(true);
    try {
      const userHasAccess = projectTypePermissions.get(projectTypeId)?.has(userId);

      if (userHasAccess) {
        const { error } = await supabase
          .from('project_type_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('project_type_id', projectTypeId);

        if (error) throw error;

        const newPerms = new Map(projectTypePermissions);
        newPerms.get(projectTypeId)?.delete(userId);
        setProjectTypePermissions(newPerms);
      } else {
        const { error } = await supabase
          .from('project_type_permissions')
          .insert({ user_id: userId, project_type_id: projectTypeId });

        if (error) throw error;

        const newPerms = new Map(projectTypePermissions);
        if (!newPerms.has(projectTypeId)) {
          newPerms.set(projectTypeId, new Set());
        }
        newPerms.get(projectTypeId)!.add(userId);
        setProjectTypePermissions(newPerms);
      }
    } catch (error) {
      console.error('Error toggling project type access:', error);
      alert('Failed to update access');
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setStaff(staff.map(s => s.id === userId ? { ...s, role: newRole } : s));
      setEditingRole(null);
      alert('Role updated successfully');
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    } finally {
      setLoading(false);
    }
  }

  const filteredStatuses = statuses.filter(s =>
    s.project_type_id === selectedProjectType && !s.is_substatus
  );

  const hasChanges = pendingChanges.size > 0;

  return (
    <div className="p-8">
      <div className="mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Client Permissions
          </button>
        )}
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6" />
          User Authorization
        </h1>
        <p className="text-sm text-slate-500 mt-1">Manage user roles and status permissions</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-6">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5" />
            Funding Project Button Access
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Control which users can see and access the Funding Project tab and create Funding Projects
          </p>
          <div className="space-y-2">
            {staff.map(member => {
              const fundingType = projectTypes.find(t => t.name === 'Funding Project');
              const hasAccess = fundingType ? projectTypePermissions.get(fundingType.id)?.has(member.id) : false;
              const isAdmin = member.role === 'admin';

              return (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="font-medium text-slate-900">{member.full_name}</div>
                    <div className="text-sm text-slate-500">{member.email}</div>
                  </div>
                  {isAdmin ? (
                    <div className="px-4 py-2 rounded-lg font-medium text-sm bg-green-100 text-green-700">
                      Admin - Always Has Access
                    </div>
                  ) : (
                    <button
                      onClick={() => fundingType && toggleProjectTypeAccess(member.id, fundingType.id)}
                      disabled={loading}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                        hasAccess
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {hasAccess ? 'Has Access' : 'No Access'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Users className="w-5 h-5" />
            User Roles
          </h2>
          <div className="space-y-2">
            {staff.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-medium text-slate-900">{member.full_name}</div>
                  <div className="text-sm text-slate-500">{member.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {editingRole === member.id ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => updateUserRole(member.id, e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => setEditingRole(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          member.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {member.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                      <button
                        onClick={() => setEditingRole(member.id)}
                        className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Change
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Status Permissions</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select User</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a user...</option>
                {staff.filter(s => s.role !== 'admin').map(member => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Project Type</label>
              <select
                value={selectedProjectType}
                onChange={(e) => setSelectedProjectType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {projectTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedUser ? (
            <>
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-slate-600 mb-2">
                  Grant permissions for <strong>{staff.find(s => s.id === selectedUser)?.full_name}</strong> to view or edit ALL projects in each status.
                </div>
                <div className="text-xs text-slate-500">
                  Note: The user will automatically have access to projects they created or are assigned as sales person.
                </div>
              </div>

              <div className="space-y-3">
                {filteredStatuses.map(status => {
                  const perm = getPermission(status.id);
                  return (
                    <div key={status.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                      <div className="font-medium text-slate-900">{status.name}</div>
                      <div className="flex items-center gap-6">
                        <button
                          onClick={() => togglePermission(status.id, 'can_view_all')}
                          className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 transition-colors"
                        >
                          {perm.can_view_all ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                          View All
                        </button>
                        <button
                          onClick={() => togglePermission(status.id, 'can_edit_all')}
                          className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 transition-colors"
                        >
                          {perm.can_edit_all ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                          Edit All
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasChanges && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={savePermissions}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setPendingChanges(new Map())}
                    disabled={loading}
                    className="px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Select a user to manage their status permissions
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Status Managers</h2>
          <p className="text-sm text-slate-500">
            Assign managers to each status. Status managers will be shown on all projects in that status.
          </p>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Project Type</label>
            <select
              value={selectedProjectType}
              onChange={(e) => setSelectedProjectType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {projectTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select
                value={selectedStatusForManager}
                onChange={(e) => setSelectedStatusForManager(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a status...</option>
                {statuses
                  .filter(s => s.project_type_id === selectedProjectType && !s.is_substatus)
                  .sort((a, b) => a.order_index - b.order_index)
                  .map(parentStatus => {
                    const substatuses = statuses.filter(s => s.parent_status_id === parentStatus.id).sort((a, b) => a.order_index - b.order_index);
                    return (
                      <optgroup key={parentStatus.id} label={parentStatus.name}>
                        <option key={`parent-${parentStatus.id}`} value={parentStatus.id}>
                          {parentStatus.name} (Main)
                        </option>
                        {substatuses.map(substatus => (
                          <option key={substatus.id} value={substatus.id}>
                            {substatus.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Manager</label>
              <select
                value={selectedManagerUser}
                onChange={(e) => setSelectedManagerUser(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a user...</option>
                {staff.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={addStatusManager}
            disabled={loading || !selectedStatusForManager || !selectedManagerUser}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2 px-4 rounded-lg transition-colors mb-6"
          >
            Add Status Manager
          </button>

          <div className="space-y-4">
            {statuses
              .filter(s => s.project_type_id === selectedProjectType && !s.is_substatus)
              .sort((a, b) => a.order_index - b.order_index)
              .map(parentStatus => {
                const substatuses = statuses.filter(s => s.parent_status_id === parentStatus.id).sort((a, b) => a.order_index - b.order_index);
                const hasManagers = substatuses.some(s => statusManagers.some(m => m.status_id === s.id));
                if (!hasManagers) return null;

                return (
                  <div key={parentStatus.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 font-semibold text-slate-900">
                      {parentStatus.name}
                    </div>
                    <div className="p-4 space-y-3">
                      {substatuses.map(substatus => {
                        const managers = statusManagers.filter(m => m.status_id === substatus.id);
                        if (managers.length === 0) return null;

                        return (
                          <div key={substatus.id} className="border border-slate-200 rounded-lg p-3">
                            <div className="font-medium text-slate-900 mb-2 text-sm">
                              {substatus.name}
                            </div>
                            <div className="space-y-2">
                              {managers.map(manager => (
                                <div key={manager.id} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                                  <div>
                                    <div className="font-medium text-sm text-slate-900">
                                      {manager.staff?.full_name || 'Unknown User'}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {manager.staff?.email}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => removeStatusManager(manager.id)}
                                    disabled={loading}
                                    className="text-red-600 hover:text-red-700 disabled:opacity-50 text-sm font-medium"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            {statusManagers.filter(m =>
              statuses.find(s => s.id === m.status_id && s.project_type_id === selectedProjectType)
            ).length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No status managers assigned yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
