import { CheckCircle2, Circle, Bell } from 'lucide-react';

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
  sales_source?: string;
  sales_person_id?: string;
  upload_link?: string;
  start_date?: string;
  attachment?: string;
  deposit_paid?: boolean;
  deposit_amount?: number;
  project_name?: string;
  service_fee_percentage?: number;
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

export function ProjectListView({
  projects,
  projectTypes,
  statuses,
  selectedStatus,
  onProjectClick,
  onClientClick
}: ProjectListViewProps) {
  const isFundingProject = (project: Project) => {
    return projectTypes?.find(pt => pt.id === project.project_type_id)?.name === 'Funding Project';
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
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
              {formatDate(project.next_due_date)}
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
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Abbreviation
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Next Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Submission Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Start Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                End Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Tasks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {renderProjectRows(projects)}
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
