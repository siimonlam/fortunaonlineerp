import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  FileText,
  TrendingUp,
  BarChart3,
  Instagram,
  Facebook,
  Globe,
  DollarSign,
  Users,
  MessageSquare,
  CheckSquare,
  Calendar,
  Folder,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  ExternalLink,
  Loader2,
  Menu,
  X,
  AlertCircle,
  Bell,
  Edit,
  Save
} from 'lucide-react';
import MarketingInstagramSection from './MarketingInstagramSection';
import MarketingFacebookSection from './MarketingFacebookSection';
import MarketingMetaAdSection from './MarketingMetaAdSection';
import { SocialMediaPostsManager } from './SocialMediaPostsManager';
import { InfluencerCollaboration } from './InfluencerCollaboration';
import { MarketingTasksSection } from './MarketingTasksSection';
import MarketingMeetingsSection from './MarketingMeetingsSection';
import { MarketingShareResourcesSection } from './MarketingShareResourcesSection';
import { createMarketingProjectFolders } from '../utils/googleDriveUtils';

interface MarketingProject {
  id: string;
  project_reference?: string;
  brand_name: string;
  company_name: string;
  company_name_chinese: string;
  title: string;
  description: string;
  contact_name: string;
  contact_number: string;
  email: string;
  address: string;
  project_name: string;
  client_id: string;
  parent_client_id: string | null;
  google_drive_folder_id?: string | null;
  clients?: {
    client_number: string;
  };
}

interface MarketingProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

type MarketingSection =
  | 'summary'
  | 'amazon-sales'
  | 'amazon-ad'
  | 'website'
  | 'meta-ad'
  | 'instagram-post'
  | 'facebook-post'
  | 'google-ad'
  | 'influencer-collab'
  | 'influencer-management'
  | 'social-media'
  | 'tasks'
  | 'meetings'
  | 'files';

export default function MarketingProjectDetail({ projectId, onBack }: MarketingProjectDetailProps) {
  const [project, setProject] = useState<MarketingProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<MarketingSection>('summary');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['summary']));
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [visibleSections, setVisibleSections] = useState<string[]>([]);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [socialMediaTaskCounts, setSocialMediaTaskCounts] = useState<{ pastDue: number; upcoming: number }>({ pastDue: 0, upcoming: 0 });
  const [marketingTaskCounts, setMarketingTaskCounts] = useState<{ pastDue: number; upcoming: number }>({ pastDue: 0, upcoming: 0 });
  const [meetingTaskCounts, setMeetingTaskCounts] = useState<{ pastDue: number; upcoming: number }>({ pastDue: 0, upcoming: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFormData, setEditFormData] = useState({
    brand_name: '',
    company_name: '',
    company_name_chinese: '',
    contact_name: '',
    contact_number: '',
    email: '',
    address: '',
    description: '',
    google_drive_folder_id: ''
  });

  useEffect(() => {
    fetchProject();
    fetchPermissions();
    fetchSocialMediaTaskCounts();
    fetchMarketingTaskCounts();
    fetchMeetingTaskCounts();

    const channel = supabase
      .channel(`marketing-project-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'marketing_projects', filter: `id=eq.${projectId}` },
        () => {
          fetchProject();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketing_social_post_steps' },
        () => {
          fetchSocialMediaTaskCounts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketing_social_posts' },
        () => {
          fetchSocialMediaTaskCounts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketing_tasks' },
        () => {
          fetchMarketingTaskCounts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          fetchMeetingTaskCounts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketing_meetings' },
        () => {
          fetchMeetingTaskCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('marketing_projects')
        .select('*, clients:client_id(client_number)')
        .eq('id', projectId)
        .maybeSingle();

      if (error) throw error;
      setProject(data);
    } catch (err: any) {
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role === 'admin') {
        setHasFullAccess(true);
        return;
      }

      const { data: permissionData } = await supabase
        .from('marketing_project_staff')
        .select('visible_sections, can_edit')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (permissionData) {
        const sections = Array.isArray(permissionData.visible_sections)
          ? permissionData.visible_sections
          : [];

        if (sections.length === 0) {
          setHasFullAccess(true);
        } else {
          setVisibleSections(sections);
          setHasFullAccess(false);
        }
        return;
      }

      const { data: buttonAccess } = await supabase
        .from('marketing_button_staff')
        .select(`
          button_id,
          marketing_project_buttons!inner(
            marketing_project_id
          )
        `)
        .eq('user_id', user.id)
        .eq('marketing_project_buttons.marketing_project_id', projectId);

      if (buttonAccess && buttonAccess.length > 0) {
        setHasFullAccess(true);
        return;
      }

      const { data: buttons } = await supabase
        .from('marketing_project_buttons')
        .select('id')
        .eq('marketing_project_id', projectId);

      if (!buttons || buttons.length === 0) {
        setHasFullAccess(true);
        return;
      }

      const buttonIds = buttons.map(b => b.id);
      const { data: anyRestrictions } = await supabase
        .from('marketing_button_staff')
        .select('button_id')
        .in('button_id', buttonIds);

      if (!anyRestrictions || anyRestrictions.length === 0) {
        setHasFullAccess(true);
      } else {
        setHasFullAccess(false);
        setVisibleSections([]);
      }
    } catch (err: any) {
      console.error('Error fetching permissions:', err);
      setHasFullAccess(true);
    }
  };

  const fetchSocialMediaTaskCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: socialPostSteps, error } = await supabase
        .from('marketing_social_post_steps')
        .select(`
          id,
          due_date,
          status,
          post:marketing_social_posts!inner(id, marketing_project_id)
        `)
        .eq('post.marketing_project_id', projectId)
        .eq('assigned_to', user.id)
        .neq('status', 'completed')
        .not('due_date', 'is', null);

      if (error) throw error;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const pastDue = (socialPostSteps || []).filter(step => {
        const deadline = new Date(step.due_date);
        deadline.setHours(0, 0, 0, 0);
        return deadline < now;
      }).length;

      const upcoming = (socialPostSteps || []).filter(step => {
        const deadline = new Date(step.due_date);
        deadline.setHours(0, 0, 0, 0);
        return deadline >= now;
      }).length;

      setSocialMediaTaskCounts({ pastDue, upcoming });
    } catch (err: any) {
      console.error('Error fetching social media task counts:', err);
    }
  };

  const fetchMarketingTaskCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: marketingTasks, error } = await supabase
        .from('marketing_tasks')
        .select('id, deadline, completed')
        .eq('marketing_project_id', projectId)
        .eq('assigned_to', user.id)
        .eq('completed', false)
        .not('deadline', 'is', null);

      if (error) throw error;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const pastDue = (marketingTasks || []).filter(task => {
        const deadline = new Date(task.deadline);
        deadline.setHours(0, 0, 0, 0);
        return deadline < now;
      }).length;

      const upcoming = (marketingTasks || []).filter(task => {
        const deadline = new Date(task.deadline);
        deadline.setHours(0, 0, 0, 0);
        return deadline >= now;
      }).length;

      setMarketingTaskCounts({ pastDue, upcoming });
    } catch (err: any) {
      console.error('Error fetching marketing task counts:', err);
    }
  };

  const fetchMeetingTaskCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: meetings, error: meetingsError } = await supabase
        .from('marketing_meetings')
        .select('id')
        .eq('marketing_project_id', projectId);

      if (meetingsError) throw meetingsError;

      const meetingIds = (meetings || []).map(m => m.id);

      if (meetingIds.length === 0) {
        setMeetingTaskCounts({ pastDue: 0, upcoming: 0 });
        return;
      }

      const { data: meetingTasks, error } = await supabase
        .from('tasks')
        .select('id, deadline, completed')
        .in('meeting_id', meetingIds)
        .eq('assigned_to', user.id)
        .eq('completed', false)
        .not('deadline', 'is', null);

      if (error) throw error;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const pastDue = (meetingTasks || []).filter(task => {
        const deadline = new Date(task.deadline);
        deadline.setHours(0, 0, 0, 0);
        return deadline < now;
      }).length;

      const upcoming = (meetingTasks || []).filter(task => {
        const deadline = new Date(task.deadline);
        deadline.setHours(0, 0, 0, 0);
        return deadline >= now;
      }).length;

      setMeetingTaskCounts({ pastDue, upcoming });
    } catch (err: any) {
      console.error('Error fetching meeting task counts:', err);
    }
  };

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const handleCreateFolders = async () => {
    if (!project) return;

    if (!project.project_reference) {
      setFolderError('Project reference (MP0000 format) is missing. Please ensure the project was created correctly.');
      return;
    }

    console.log('Creating folders with:', {
      projectId: project.id,
      marketingReference: project.project_reference,
      brandName: project.brand_name,
      companyName: project.company_name
    });

    setCreatingFolders(true);
    setFolderError(null);

    try {
      const result = await createMarketingProjectFolders(
        project.id,
        project.project_reference,
        project.brand_name,
        project.company_name
      );

      await supabase
        .from('marketing_projects')
        .update({
          google_drive_folder_id: result.root_folder_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      setProject(prev => prev ? { ...prev, google_drive_folder_id: result.root_folder_id } : null);
      alert('Successfully created folder structure for marketing project!');
    } catch (error: any) {
      console.error('Error creating folders:', error);
      setFolderError(error.message || 'Failed to create folders');
    } finally {
      setCreatingFolders(false);
    }
  };

  const handleEdit = () => {
    if (!project) return;
    setEditFormData({
      brand_name: project.brand_name || '',
      company_name: project.company_name || '',
      company_name_chinese: project.company_name_chinese || '',
      contact_name: project.contact_name || '',
      contact_number: project.contact_number || '',
      email: project.email || '',
      address: project.address || '',
      description: project.description || '',
      google_drive_folder_id: project.google_drive_folder_id || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData({
      brand_name: '',
      company_name: '',
      company_name_chinese: '',
      contact_name: '',
      contact_number: '',
      email: '',
      address: '',
      description: '',
      google_drive_folder_id: ''
    });
  };

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('marketing_projects')
        .update({
          brand_name: editFormData.brand_name,
          company_name: editFormData.company_name,
          company_name_chinese: editFormData.company_name_chinese,
          contact_name: editFormData.contact_name,
          contact_number: editFormData.contact_number,
          email: editFormData.email,
          address: editFormData.address,
          description: editFormData.description,
          google_drive_folder_id: editFormData.google_drive_folder_id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;

      setProject(prev => prev ? {
        ...prev,
        ...editFormData,
        google_drive_folder_id: editFormData.google_drive_folder_id || null
      } : null);

      setIsEditing(false);
      alert('Project updated successfully!');
    } catch (error: any) {
      console.error('Error updating project:', error);
      alert(`Failed to update project: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const isSectionVisible = (sectionId: string): boolean => {
    if (hasFullAccess) return true;
    return visibleSections.includes(sectionId);
  };

  const allNavigationGroups = [
    {
      id: 'summary',
      title: 'A. Summary',
      items: [
        { id: 'summary' as MarketingSection, label: 'Summary', icon: FileText }
      ]
    },
    {
      id: 'reports',
      title: 'B. Reports',
      items: [
        { id: 'amazon-sales' as MarketingSection, label: 'Amazon Sales', icon: DollarSign },
        { id: 'amazon-ad' as MarketingSection, label: 'Amazon Ad', icon: TrendingUp },
        { id: 'website' as MarketingSection, label: 'Website', icon: Globe },
        { id: 'meta-ad' as MarketingSection, label: 'Meta Ad', icon: BarChart3 },
        { id: 'instagram-post' as MarketingSection, label: 'Instagram Post', icon: Instagram },
        { id: 'facebook-post' as MarketingSection, label: 'Facebook Post', icon: Facebook },
        { id: 'google-ad' as MarketingSection, label: 'Google Ad', icon: TrendingUp },
        { id: 'influencer-collab' as MarketingSection, label: 'Influencer Collab', icon: Users }
      ]
    },
    {
      id: 'project-management',
      title: 'C. Project Management',
      items: [
        { id: 'influencer-management' as MarketingSection, label: 'Influencer Management', icon: Users },
        { id: 'social-media' as MarketingSection, label: 'Social Media Management', icon: MessageSquare },
        { id: 'tasks' as MarketingSection, label: 'Tasks', icon: CheckSquare },
        { id: 'meetings' as MarketingSection, label: 'Meeting Record', icon: Calendar },
        { id: 'files' as MarketingSection, label: 'Files', icon: Folder }
      ]
    }
  ];

  const navigationGroups = allNavigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => isSectionVisible(item.id))
  })).filter(group => group.items.length > 0);

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'summary':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Project Overview</h3>
                {!isEditing ? (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Project Reference</label>
                  <p className="font-medium">{project?.project_reference}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Brand Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.brand_name}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, brand_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="font-medium">{project?.brand_name}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Company Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.company_name}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="font-medium">{project?.company_name}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Company Name (Chinese)</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.company_name_chinese}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, company_name_chinese: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="font-medium">{project?.company_name_chinese || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Contact Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.contact_name}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="font-medium">{project?.contact_name || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Contact Number</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.contact_number}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, contact_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="font-medium">{project?.contact_number || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="font-medium">{project?.email || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Address</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.address}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="font-medium">{project?.address || '-'}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-gray-600 block mb-1">Google Drive Folder ID</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.google_drive_folder_id}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, google_drive_folder_id: e.target.value }))}
                      placeholder="Enter Google Drive folder ID (e.g., 1ABC...xyz)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="font-medium">{project?.google_drive_folder_id || '-'}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Find the folder ID in the Google Drive URL: drive.google.com/drive/folders/<span className="font-semibold">[FOLDER_ID]</span>
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-1">Description</label>
                {isEditing ? (
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="mt-1">{project?.description || '-'}</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'instagram-post':
        return <MarketingInstagramSection projectId={projectId} clientNumber={project?.parent_client_id || null} />;

      case 'facebook-post':
        return <MarketingFacebookSection projectId={projectId} clientNumber={project?.parent_client_id || null} />;

      case 'meta-ad':
        return <MarketingMetaAdSection projectId={projectId} clientNumber={project?.parent_client_id || null} />;

      case 'influencer-collab':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-12">
              <div className="text-blue-600 mb-4">
                <Users size={64} className="mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Influencer Collaboration</h3>
              <p className="text-slate-600 mb-4">
                View and analyze influencer collaboration performance metrics here.
              </p>
              <button
                onClick={() => setActiveSection('influencer-management')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Manage Influencers
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        );

      case 'social-media':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <SocialMediaPostsManager marketingProjectId={projectId} />
          </div>
        );

      case 'files':
        return (
          <div className="h-[calc(100vh-12rem)]">
            <MarketingShareResourcesSection
              marketingProjectId={projectId}
              driveFolderId={project?.google_drive_folder_id}
            />
          </div>
        );

      case 'influencer-management':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <InfluencerCollaboration marketingProjectId={projectId} />
          </div>
        );

      case 'tasks':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <MarketingTasksSection projectId={projectId} project={project} onTasksChange={fetchMarketingTaskCounts} />
          </div>
        );

      case 'meetings':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <MarketingMeetingsSection marketingProjectId={projectId} />
          </div>
        );

      default:
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <BarChart3 size={64} className="mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {navigationGroups.flatMap(g => g.items).find(i => i.id === activeSection)?.label}
              </h3>
              <p className="text-gray-600">
                This section is coming soon. You'll be able to track and manage {activeSection.replace('-', ' ')} data here.
              </p>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Project not found</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {sidebarVisible && (
        <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto relative">
          <div className="pt-2 px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={16} />
                Back to Marketing
              </button>
              <button
                onClick={() => setSidebarVisible(false)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                title="Hide sidebar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-3">
              <h3 className="font-bold text-gray-900">{project.brand_name}</h3>
              <p className="text-xs text-gray-600">{project.project_reference}</p>
            </div>

            <nav className="space-y-1">
              {navigationGroups.map((group) => (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span>{group.title}</span>
                    {expandedGroups.has(group.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>

                  {expandedGroups.has(group.id) && (
                    <div className="ml-2 mt-1 space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isSocialMedia = item.id === 'social-media';
                        const isTasks = item.id === 'tasks';
                        const isMeetings = item.id === 'meetings';

                        const socialPastDue = isSocialMedia && socialMediaTaskCounts.pastDue > 0;
                        const socialUpcoming = isSocialMedia && socialMediaTaskCounts.upcoming > 0;

                        const tasksPastDue = isTasks && marketingTaskCounts.pastDue > 0;
                        const tasksUpcoming = isTasks && marketingTaskCounts.upcoming > 0;

                        const meetingsPastDue = isMeetings && meetingTaskCounts.pastDue > 0;
                        const meetingsUpcoming = isMeetings && meetingTaskCounts.upcoming > 0;

                        const hasPastDue = socialPastDue || tasksPastDue || meetingsPastDue;
                        const hasUpcoming = socialUpcoming || tasksUpcoming || meetingsUpcoming;

                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                              activeSection === item.id
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon size={16} />
                              <span>{item.label}</span>
                            </span>
                            {(hasPastDue || hasUpcoming) && (
                              <span className="flex items-center gap-1">
                                {hasPastDue && (
                                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-white bg-red-600 px-1.5 py-0.5 rounded-md shadow-sm">
                                    <AlertCircle className="w-3 h-3" />
                                    {isSocialMedia ? socialMediaTaskCounts.pastDue : isTasks ? marketingTaskCounts.pastDue : meetingTaskCounts.pastDue}
                                  </span>
                                )}
                                {hasUpcoming && (
                                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded-md border border-orange-300">
                                    <Bell className="w-3 h-3" />
                                    {isSocialMedia ? socialMediaTaskCounts.upcoming : isTasks ? marketingTaskCounts.upcoming : meetingTaskCounts.upcoming}
                                  </span>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {!sidebarVisible && (
        <div className="w-12 bg-gray-50 border-r border-gray-200 flex flex-col items-center pt-2">
          <button
            onClick={() => setSidebarVisible(true)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
            title="Show sidebar"
          >
            <Menu size={20} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="pt-4 px-6 pb-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {navigationGroups.flatMap(g => g.items).find(i => i.id === activeSection)?.label}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {project.brand_name} - {project.project_reference}
            </p>
          </div>

          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
}
