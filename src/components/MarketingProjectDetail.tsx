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
  ChevronRight
} from 'lucide-react';

interface MarketingProject {
  id: string;
  project_reference: string;
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['summary', 'reports', 'project-management']));

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('marketing_projects')
        .select('*')
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

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const navigationGroups = [
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

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'summary':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Project Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Project Reference</label>
                  <p className="font-medium">{project?.project_reference}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Brand Name</label>
                  <p className="font-medium">{project?.brand_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Company Name</label>
                  <p className="font-medium">{project?.company_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Company Name (Chinese)</label>
                  <p className="font-medium">{project?.company_name_chinese || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Contact Name</label>
                  <p className="font-medium">{project?.contact_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Contact Number</label>
                  <p className="font-medium">{project?.contact_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Email</label>
                  <p className="font-medium">{project?.email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Address</label>
                  <p className="font-medium">{project?.address || '-'}</p>
                </div>
              </div>
              {project?.description && (
                <div className="mt-4">
                  <label className="text-sm text-gray-600">Description</label>
                  <p className="mt-1">{project.description}</p>
                </div>
              )}
            </div>
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
      <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
        <div className="pt-2 px-4 pb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft size={16} />
            Back to Marketing
          </button>

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
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveSection(item.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            activeSection === item.id
                              ? 'bg-blue-100 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon size={16} />
                          <span>{item.label}</span>
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
