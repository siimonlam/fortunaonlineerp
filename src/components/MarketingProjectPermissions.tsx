import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Shield, Eye, Edit, Save, X, Search } from 'lucide-react';

interface User {
  id: string;
  email: string;
  raw_user_meta_data?: {
    full_name?: string;
  };
}

interface MarketingProject {
  id: string;
  title: string;
  project_reference: string;
  company_name: string;
  created_by: string;
  sales_person_id: string;
}

interface ProjectPermission {
  id?: string;
  project_id: string;
  user_id: string;
  can_view: boolean;
  can_edit: boolean;
}

export function MarketingProjectPermissions() {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<MarketingProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [permissions, setPermissions] = useState<ProjectPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUsers();
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadPermissions();
    }
  }, [selectedProject]);

  const loadUsers = async () => {
    const { data: authUsers, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('Error loading users:', error);
      return;
    }
    setUsers(authUsers.users || []);
  };

  const loadProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('marketing_projects')
      .select('id, title, project_reference, company_name, created_by, sales_person_id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading projects:', error);
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  };

  const loadPermissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('marketing_project_staff')
      .select('*')
      .eq('project_id', selectedProject);

    if (error) {
      console.error('Error loading permissions:', error);
    } else {
      setPermissions(data || []);
    }
    setLoading(false);
  };

  const getUserPermission = (userId: string): ProjectPermission => {
    const existing = permissions.find(p => p.user_id === userId);
    return existing || {
      project_id: selectedProject,
      user_id: userId,
      can_view: false,
      can_edit: false
    };
  };

  const updatePermission = (userId: string, field: 'can_view' | 'can_edit', value: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.user_id === userId);
      if (existing) {
        return prev.map(p => p.user_id === userId ? { ...p, [field]: value } : p);
      } else {
        return [...prev, {
          project_id: selectedProject,
          user_id: userId,
          can_view: field === 'can_view' ? value : false,
          can_edit: field === 'can_edit' ? value : false
        }];
      }
    });
  };

  const savePermissions = async () => {
    if (!selectedProject) return;

    setSaving(true);
    try {
      const permissionsToSave = permissions.filter(p => p.can_view || p.can_edit);

      const { error: deleteError } = await supabase
        .from('marketing_project_staff')
        .delete()
        .eq('project_id', selectedProject);

      if (deleteError) throw deleteError;

      if (permissionsToSave.length > 0) {
        const { error: insertError } = await supabase
          .from('marketing_project_staff')
          .insert(permissionsToSave.map(p => ({
            project_id: p.project_id,
            user_id: p.user_id,
            can_view: p.can_view,
            can_edit: p.can_edit
          })));

        if (insertError) throw insertError;
      }

      alert('Permissions saved successfully');
      await loadPermissions();
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      alert('Error saving permissions: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getUserName = (user: User) => {
    return user.raw_user_meta_data?.full_name || user.email;
  };

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  const filteredUsers = users.filter(user =>
    getUserName(user).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isCreatorOrSales = (userId: string) => {
    if (!selectedProjectData) return false;
    return userId === selectedProjectData.created_by || userId === selectedProjectData.sales_person_id;
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-100">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Marketing Project Permissions
            </h3>
            <p className="text-slate-600 text-sm">
              Manage view and edit permissions for individual marketing projects.
              By default, all users can view all projects. Creators and sales persons automatically have edit access.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Select Marketing Project
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Select a project --</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.project_reference || project.title} - {project.company_name}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={savePermissions}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      User
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                      Role
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                      <div className="flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />
                        View
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                      <div className="flex items-center justify-center gap-2">
                        <Edit className="w-4 h-4" />
                        Edit
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map(user => {
                    const permission = getUserPermission(user.id);
                    const isSpecialRole = isCreatorOrSales(user.id);

                    return (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {getUserName(user)}
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {user.id === selectedProjectData?.created_by && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
                              Creator
                            </span>
                          )}
                          {user.id === selectedProjectData?.sales_person_id && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                              Sales
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={permission.can_view}
                            onChange={(e) => updatePermission(user.id, 'can_view', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={permission.can_edit || isSpecialRole}
                            onChange={(e) => updatePermission(user.id, 'can_edit', e.target.checked)}
                            disabled={isSpecialRole}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {isSpecialRole && (
                            <div className="text-xs text-slate-500 mt-1">Auto</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700">
                  <p className="font-medium mb-1">Permission Notes:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>All authenticated users can view all marketing projects by default</li>
                    <li>Project creators and sales persons automatically have edit access</li>
                    <li>Admins always have full access to all projects</li>
                    <li>You can grant additional users edit access using the checkboxes above</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedProject && (
          <div className="text-center py-12 text-slate-500">
            <Shield className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p>Select a marketing project to manage permissions</p>
          </div>
        )}
      </div>
    </div>
  );
}
