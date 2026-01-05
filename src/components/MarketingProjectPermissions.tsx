import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Shield, Eye, Edit, Save, X, Search, Layers } from 'lucide-react';

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
  visible_sections?: string[];
}

interface MarketingSection {
  id: string;
  label: string;
  category: string;
}

interface MarketingButton {
  id: string;
  name: string;
  display_order: number;
}

interface ButtonPermission {
  button_id: string;
  user_id: string;
}

export function MarketingProjectPermissions() {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<MarketingProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [permissions, setPermissions] = useState<ProjectPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [buttons, setButtons] = useState<MarketingButton[]>([]);
  const [buttonPermissions, setButtonPermissions] = useState<ButtonPermission[]>([]);
  const [selectedButtonUser, setSelectedButtonUser] = useState<string | null>(null);
  const [globalButtons, setGlobalButtons] = useState<MarketingButton[]>([]);
  const [globalButtonPermissions, setGlobalButtonPermissions] = useState<ButtonPermission[]>([]);
  const [activeTab, setActiveTab] = useState<'projects' | 'buttons'>('projects');

  const availableSections: MarketingSection[] = [
    { id: 'summary', label: 'Summary', category: 'A. Summary' },
    { id: 'amazon-sales', label: 'Amazon Sales', category: 'B. Reports' },
    { id: 'amazon-ad', label: 'Amazon Ad', category: 'B. Reports' },
    { id: 'website', label: 'Website', category: 'B. Reports' },
    { id: 'meta-ad', label: 'Meta Ad', category: 'B. Reports' },
    { id: 'instagram-post', label: 'Instagram Post', category: 'B. Reports' },
    { id: 'facebook-post', label: 'Facebook Post', category: 'B. Reports' },
    { id: 'google-ad', label: 'Google Ad', category: 'B. Reports' },
    { id: 'influencer-collab', label: 'Influencer Collab', category: 'B. Reports' },
    { id: 'influencer-management', label: 'Influencer Management', category: 'C. Project Management' },
    { id: 'social-media', label: 'Social Media Management', category: 'C. Project Management' },
    { id: 'tasks', label: 'Tasks', category: 'C. Project Management' },
    { id: 'meetings', label: 'Meeting Record', category: 'C. Project Management' },
    { id: 'files', label: 'Files', category: 'C. Project Management' }
  ];

  useEffect(() => {
    loadUsers();
    loadProjects();
    loadGlobalButtons();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadPermissions();
      loadButtonsAndPermissions();
    }
  }, [selectedProject]);

  const loadButtonsAndPermissions = async () => {
    await loadButtons();
  };

  useEffect(() => {
    if (buttons.length > 0) {
      loadButtonPermissions();
    }
  }, [buttons]);

  useEffect(() => {
    if (globalButtons.length > 0) {
      loadGlobalButtonPermissions();
    }
  }, [globalButtons]);

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

  const loadButtons = async () => {
    const { data, error } = await supabase
      .from('marketing_project_buttons')
      .select('id, name, display_order')
      .eq('source_project_id', selectedProject)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error loading buttons:', error);
    } else {
      setButtons(data || []);
    }
  };

  const loadButtonPermissions = async () => {
    const { data, error } = await supabase
      .from('marketing_button_staff')
      .select('button_id, user_id')
      .in('button_id', buttons.map(b => b.id));

    if (error) {
      console.error('Error loading button permissions:', error);
    } else {
      setButtonPermissions(data || []);
    }
  };

  const loadGlobalButtons = async () => {
    const { data, error } = await supabase
      .from('marketing_project_buttons')
      .select('id, name, display_order')
      .is('source_project_id', null)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error loading global buttons:', error);
    } else {
      setGlobalButtons(data || []);
    }
  };

  const loadGlobalButtonPermissions = async () => {
    const { data, error } = await supabase
      .from('marketing_button_staff')
      .select('button_id, user_id')
      .in('button_id', globalButtons.map(b => b.id));

    if (error) {
      console.error('Error loading global button permissions:', error);
    } else {
      setGlobalButtonPermissions(data || []);
    }
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
      const formattedData = (data || []).map(p => ({
        ...p,
        visible_sections: Array.isArray(p.visible_sections) ? p.visible_sections : []
      }));
      setPermissions(formattedData);
    }
    setLoading(false);
  };

  const getUserPermission = (userId: string): ProjectPermission => {
    const existing = permissions.find(p => p.user_id === userId);
    return existing || {
      project_id: selectedProject,
      user_id: userId,
      can_view: false,
      can_edit: false,
      visible_sections: []
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
          can_edit: field === 'can_edit' ? value : false,
          visible_sections: []
        }];
      }
    });
  };

  const toggleSection = (userId: string, sectionId: string) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.user_id === userId);
      const currentSections = existing?.visible_sections || [];
      const newSections = currentSections.includes(sectionId)
        ? currentSections.filter(s => s !== sectionId)
        : [...currentSections, sectionId];

      if (existing) {
        return prev.map(p => p.user_id === userId ? { ...p, visible_sections: newSections } : p);
      } else {
        return [...prev, {
          project_id: selectedProject,
          user_id: userId,
          can_view: false,
          can_edit: false,
          visible_sections: newSections
        }];
      }
    });
  };

  const toggleAllSections = (userId: string, enable: boolean) => {
    const allSectionIds = availableSections.map(s => s.id);
    setPermissions(prev => {
      const existing = prev.find(p => p.user_id === userId);
      const newSections = enable ? allSectionIds : [];

      if (existing) {
        return prev.map(p => p.user_id === userId ? { ...p, visible_sections: newSections } : p);
      } else {
        return [...prev, {
          project_id: selectedProject,
          user_id: userId,
          can_view: false,
          can_edit: false,
          visible_sections: newSections
        }];
      }
    });
  };

  const getUserButtonAccess = (userId: string, buttonId: string): boolean => {
    return buttonPermissions.some(bp => bp.button_id === buttonId && bp.user_id === userId);
  };

  const toggleButtonAccess = (userId: string, buttonId: string) => {
    setButtonPermissions(prev => {
      const exists = prev.some(bp => bp.button_id === buttonId && bp.user_id === userId);
      if (exists) {
        return prev.filter(bp => !(bp.button_id === buttonId && bp.user_id === userId));
      } else {
        return [...prev, { button_id: buttonId, user_id: userId }];
      }
    });
  };

  const toggleAllButtons = (userId: string, enable: boolean) => {
    setButtonPermissions(prev => {
      const filtered = prev.filter(bp => bp.user_id !== userId);
      if (enable) {
        const newPermissions = buttons.map(b => ({ button_id: b.id, user_id: userId }));
        return [...filtered, ...newPermissions];
      }
      return filtered;
    });
  };

  const saveButtonPermissions = async () => {
    if (!selectedProject) return;

    setSaving(true);
    try {
      const buttonIds = buttons.map(b => b.id);

      const { error: deleteError } = await supabase
        .from('marketing_button_staff')
        .delete()
        .in('button_id', buttonIds);

      if (deleteError) throw deleteError;

      if (buttonPermissions.length > 0) {
        const { error: insertError } = await supabase
          .from('marketing_button_staff')
          .insert(buttonPermissions.map(bp => ({
            button_id: bp.button_id,
            user_id: bp.user_id
          })));

        if (insertError) throw insertError;
      }

      alert('Button permissions saved successfully');
      await loadButtonPermissions();
    } catch (error: any) {
      console.error('Error saving button permissions:', error);
      alert('Error saving button permissions: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getGlobalButtonAccess = (userId: string, buttonId: string): boolean => {
    return globalButtonPermissions.some(bp => bp.button_id === buttonId && bp.user_id === userId);
  };

  const toggleGlobalButtonAccess = (userId: string, buttonId: string) => {
    setGlobalButtonPermissions(prev => {
      const exists = prev.some(bp => bp.button_id === buttonId && bp.user_id === userId);
      if (exists) {
        return prev.filter(bp => !(bp.button_id === buttonId && bp.user_id === userId));
      } else {
        return [...prev, { button_id: buttonId, user_id: userId }];
      }
    });
  };

  const toggleAllGlobalButtons = (userId: string, enable: boolean) => {
    setGlobalButtonPermissions(prev => {
      const filtered = prev.filter(bp => bp.user_id !== userId);
      if (enable) {
        const newPermissions = globalButtons.map(b => ({ button_id: b.id, user_id: userId }));
        return [...filtered, ...newPermissions];
      }
      return filtered;
    });
  };

  const saveGlobalButtonPermissions = async () => {
    setSaving(true);
    try {
      const buttonIds = globalButtons.map(b => b.id);

      const { error: deleteError } = await supabase
        .from('marketing_button_staff')
        .delete()
        .in('button_id', buttonIds);

      if (deleteError) throw deleteError;

      if (globalButtonPermissions.length > 0) {
        const { error: insertError } = await supabase
          .from('marketing_button_staff')
          .insert(globalButtonPermissions.map(bp => ({
            button_id: bp.button_id,
            user_id: bp.user_id
          })));

        if (insertError) throw insertError;
      }

      alert('Global button permissions saved successfully');
      await loadGlobalButtonPermissions();
    } catch (error: any) {
      console.error('Error saving global button permissions:', error);
      alert('Error saving global button permissions: ' + error.message);
    } finally {
      setSaving(false);
    }
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
            can_edit: p.can_edit,
            visible_sections: p.visible_sections || []
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
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'projects'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Project Permissions
          </button>
          <button
            onClick={() => setActiveTab('buttons')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'buttons'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Button Visibility
          </button>
        </div>

        {activeTab === 'buttons' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Global Button Visibility</h4>
                  <p className="text-sm text-slate-600">Control which users can see custom marketing buttons (G-NiIB, DJT, Fortuna, 乞龷)</p>
                </div>
              </div>
              <button
                onClick={saveGlobalButtonPermissions}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Button Access'}
              </button>
            </div>

            {globalButtons.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Layers className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No global buttons found</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-700 w-1/4">
                          Button Name
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">
                          Visible to Users
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-700 w-64">
                          Assign Access
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {globalButtons.map(button => {
                        const usersWithAccess = users.filter(user =>
                          getGlobalButtonAccess(user.id, button.id)
                        );

                        return (
                          <tr key={button.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                <span className="font-medium text-slate-900">{button.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {usersWithAccess.length === 0 ? (
                                <span className="text-sm text-slate-500 italic">All users (no restrictions)</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {usersWithAccess.map(user => (
                                    <span
                                      key={user.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full"
                                    >
                                      {getUserName(user)}
                                      <button
                                        onClick={() => toggleGlobalButtonAccess(user.id, button.id)}
                                        className="hover:bg-purple-200 rounded-full p-0.5 transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      toggleGlobalButtonAccess(e.target.value, button.id);
                                      e.target.value = '';
                                    }
                                  }}
                                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                                  defaultValue=""
                                >
                                  <option value="">Add user...</option>
                                  {users
                                    .filter(user => !getGlobalButtonAccess(user.id, button.id))
                                    .map(user => (
                                      <option key={user.id} value={user.id}>
                                        {getUserName(user)}
                                      </option>
                                    ))
                                  }
                                </select>
                                {usersWithAccess.length > 0 && (
                                  <button
                                    onClick={() => {
                                      usersWithAccess.forEach(user => {
                                        toggleGlobalButtonAccess(user.id, button.id);
                                      });
                                    }}
                                    className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors whitespace-nowrap"
                                    title="Remove all users"
                                  >
                                    Clear All
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">Note:</span> If no users are selected for a button, it will be visible to all users. Once you add specific users, only those users will see the button in the Marketing sidebar.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <>
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
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map(user => {
                    const permission = getUserPermission(user.id);
                    const isSpecialRole = isCreatorOrSales(user.id);
                    const visibleSectionCount = permission.visible_sections?.length || 0;

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
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
                            className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            {visibleSectionCount > 0 ? `${visibleSectionCount} sections` : 'Set sections'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

{selectedUser && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">
                    Visible Sections for {getUserName(users.find(u => u.id === selectedUser)!)}
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAllSections(selectedUser, true)}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => toggleAllSections(selectedUser, false)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {['A. Summary', 'B. Reports', 'C. Project Management'].map(category => (
                    <div key={category}>
                      <h5 className="font-medium text-slate-700 mb-2">{category}</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {availableSections
                          .filter(s => s.category === category)
                          .map(section => {
                            const permission = getUserPermission(selectedUser);
                            const isChecked = permission.visible_sections?.includes(section.id) || false;

                            return (
                              <label key={section.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSection(selectedUser, section.id)}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">{section.label}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700">
                  <p className="font-medium mb-1">Permission Notes:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>All authenticated users can view all marketing projects by default</li>
                    <li>Click "Set sections" to control which tabs/buttons users can access</li>
                    <li>Empty sections = user can access all sections</li>
                    <li>Project creators and sales persons automatically have edit access</li>
                    <li>Admins always have full access to all projects</li>
                  </ul>
                </div>
              </div>
            </div>

            {buttons.length > 0 && (
              <div className="mt-6 bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Layers className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Custom Button Visibility</h4>
                      <p className="text-sm text-slate-600">Control which users can see custom marketing buttons</p>
                    </div>
                  </div>
                  <button
                    onClick={saveButtonPermissions}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Button Access'}
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                          User
                        </th>
                        {buttons.map(button => (
                          <th key={button.id} className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                            {button.name}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredUsers.map(user => {
                        const accessCount = buttons.filter(b => getUserButtonAccess(user.id, b.id)).length;

                        return (
                          <tr key={user.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm text-slate-900">
                              {getUserName(user)}
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </td>
                            {buttons.map(button => (
                              <td key={button.id} className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={getUserButtonAccess(user.id, button.id)}
                                  onChange={() => toggleButtonAccess(user.id, button.id)}
                                  className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                />
                              </td>
                            ))}
                            <td className="px-4 py-3 text-center">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => toggleAllButtons(user.id, true)}
                                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                >
                                  All
                                </button>
                                <button
                                  onClick={() => toggleAllButtons(user.id, false)}
                                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                >
                                  None
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">Note:</span> If no users are selected for a button, it will be visible to all users. Once you add specific users, only those users will see the button.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'projects' && !selectedProject && (
          <div className="text-center py-12 text-slate-500">
            <Shield className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p>Select a marketing project to manage permissions</p>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
