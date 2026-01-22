import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Bell, ArrowUpDown, ArrowUp, ArrowDown, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  deadline?: string;
  assigned_to?: string;
  staff?: Staff;
}

interface Client {
  id: string;
  name: string;
  client_number: string;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  company_name?: string;
  contact_name?: string;
  contact_number?: string;
  email?: string;
  address?: string;
  source_client_id?: string;
  status_id?: string;
  project_type_id?: string;
  client_id?: string;
  client_number?: string;
  tasks?: Task[];
  clients?: Client;
  labels?: Label[];
  sales_source?: string;
  sales_person_id?: string;
  upload_link?: string;
  start_date?: string;
  attachment?: string;
  deposit_paid?: boolean;
  deposit_amount?: number;
  project_name?: string;
  service_fee_percentage?: number;
  funding_scheme?: number;
  whatsapp_group_id?: string;
  invoice_number?: string;
  agreement_ref?: string;
  abbreviation?: string;
  project_size?: string;
  project_start_date?: string;
  project_end_date?: string;
  submission_date?: string;
  application_number?: string;
  approval_date?: string;
  next_hkpc_due_date?: string;
  next_due_date?: string;
  created_at?: string;
}

interface ProjectType {
  id: string;
  name: string;
}

interface Status {
  id: string;
  name: string;
  project_type_id: string;
  parent_status_id: string | null;
  is_substatus: boolean;
  substatus?: Status[];
}

interface ProjectListViewProps {
  projects: Project[];
  projectTypes?: ProjectType[];
  statuses?: Status[];
  selectedStatus?: string;
  onProjectClick: (project: Project) => void;
  onClientClick?: (client: Client) => void;
}

type SortField = 'next_hkpc_due_date' | 'submission_date' | 'project_start_date' | 'project_end_date';
type SortDirection = 'asc' | 'desc' | null;

const QA_ATTENTION_LABEL_ID = 'd144c662-d462-4554-be6b-19710a4733a1';

export function ProjectListView({
  projects,
  projectTypes,
  statuses,
  selectedStatus,
  onProjectClick,
  onClientClick
}: ProjectListViewProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [receivables, setReceivables] = useState<Record<string, number>>({});

  useEffect(() => {
    async function calculateReceivables() {
      const receivableMap: Record<string, number> = {};

      for (const project of projects) {
        if (!isFundingProject(project)) continue;

        const projectSize = parseFloat(project.project_size || '0');
        const fundingScheme = project.funding_scheme || 0;
        const serviceFee = project.service_fee_percentage || 0;

        const { data: invoices } = await supabase
          .from('funding_invoice')
          .select('amount')
          .eq('project_id', project.id)
          .eq('payment_status', 'Paid');

        const totalPaid = invoices?.reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0) || 0;
        const calculated = (projectSize * fundingScheme / 100 * serviceFee / 100) - totalPaid;

        receivableMap[project.id] = calculated;
      }

      setReceivables(receivableMap);
    }

    calculateReceivables();
  }, [projects, projectTypes]);

  const isFundingProject = (project: Project) => {
    return projectTypes?.find(pt => pt.id === project.project_type_id)?.name === 'Funding Project';
  };

  const hasQAAttentionLabel = (project: Project) => {
    return project.labels?.some(label => label.id === QA_ATTENTION_LABEL_ID) || false;
  };

  const getUpcomingTasksCount = (project: Project) => {
    if (!isFundingProject(project)) return 0;

    const upcomingTasks = project.tasks?.filter(task => {
      if (!task.deadline || task.completed) return false;
      const daysUntilDue = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue >= 0 && daysUntilDue <= 7;
    }) || [];

    return upcomingTasks.length;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedProjects = () => {
    if (!sortField || !sortDirection) return projects;

    return [...projects].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      const aDate = new Date(aValue).getTime();
      const bDate = new Date(bValue).getTime();

      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-slate-400" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-4 h-4 text-blue-600" />;
    }
    return <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const sortedProjects = getSortedProjects();

  const renderProjectRows = (statusProjects: Project[]) => (
    <>
      {statusProjects.map((project) => {
        const completedTasks = project.tasks?.filter((t) => t.completed).length || 0;
        const totalTasks = project.tasks?.length || 0;
        const upcomingTasksCount = getUpcomingTasksCount(project);

        return (
          <tr
            key={project.id}
            className="hover:bg-slate-50 cursor-pointer transition-colors"
            onClick={() => onProjectClick(project)}
          >
            <td className="px-6 py-4 whitespace-nowrap">
              {project.clients ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClientClick?.(project.clients!);
                  }}
                  className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                >
                  #{project.clients.client_number}
                </button>
              ) : project.client_number ? (
                <span className="text-sm font-semibold text-slate-700">#{project.client_number}</span>
              ) : (
                <span className="text-sm text-slate-500">-</span>
              )}
            </td>
            <td className="px-6 py-4">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    {project.title}
                    {upcomingTasksCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                        <Bell className="w-3 h-3" />
                        {upcomingTasksCount}
                      </span>
                    )}
                  </div>
                  {project.project_name && (
                    <div className="text-xs text-slate-600 mt-0.5">{project.project_name}</div>
                  )}
                  {project.clients && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClientClick?.(project.clients!);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline mt-0.5"
                    >
                      {project.clients.name}
                    </button>
                  )}
                </div>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-center">
              {hasQAAttentionLabel(project) ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
                  <Tag className="w-3 h-3" />
                  Q&A Attention
                </span>
              ) : (
                <span className="text-sm text-slate-400">-</span>
              )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              {project.status_id && (
                <span className="inline-block text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                  {statuses?.find(s => s.id === project.status_id)?.name}
                </span>
              )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
              {project.abbreviation || '-'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
              {receivables[project.id] !== undefined ? (
                <span className={receivables[project.id] >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  HKD ${receivables[project.id].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
              {formatDate(project.next_hkpc_due_date)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
              {formatDate(project.submission_date)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
              {formatDate(project.project_start_date)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
              {formatDate(project.project_end_date)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              {totalTasks > 0 ? (
                <div className="flex items-center gap-2 text-sm">
                  {completedTasks === totalTasks ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-slate-700">
                    {completedTasks}/{totalTasks}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-slate-500">-</span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Project
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Q&A Attention
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Abbreviation
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Receivable
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={() => handleSort('next_hkpc_due_date')}
              >
                <div className="flex items-center gap-2">
                  Next HKPC Due Date
                  {getSortIcon('next_hkpc_due_date')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={() => handleSort('submission_date')}
              >
                <div className="flex items-center gap-2">
                  Submission Date
                  {getSortIcon('submission_date')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={() => handleSort('project_start_date')}
              >
                <div className="flex items-center gap-2">
                  Start Date
                  {getSortIcon('project_start_date')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={() => handleSort('project_end_date')}
              >
                <div className="flex items-center gap-2">
                  End Date
                  {getSortIcon('project_end_date')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Tasks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {renderProjectRows(sortedProjects)}
          </tbody>
        </table>
      </div>
      {projects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No projects found.</p>
        </div>
      )}
    </div>
  );
}
