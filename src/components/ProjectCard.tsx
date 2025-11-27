import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, Bell, Tag, AlertCircle, FileText, CircleDot } from 'lucide-react';
import { ProjectCardFields } from './ProjectCardFields';

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
  project_reference?: string;
}

interface ProjectType {
  id: string;
  name: string;
}

interface Status {
  id: string;
  name: string;
  project_type_id: string;
}

interface ProjectCardProps {
  project: Project;
  isClientSection?: boolean;
  projectTypes?: ProjectType[];
  statuses?: Status[];
  allProjects?: Project[];
  statusManagers?: any[];
  showSubstatus?: boolean;
  currentUserId?: string;
  onDragStart: () => void;
  onClick: () => void;
  onCreateProject?: (projectTypeId: string) => void;
  onClientClick?: (client: Client) => void;
}

export function ProjectCard({
  project,
  isClientSection,
  projectTypes,
  statuses,
  allProjects,
  statusManagers,
  showSubstatus = false,
  currentUserId,
  onDragStart,
  onClick,
  onCreateProject,
  onClientClick
}: ProjectCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const completedTasks = project.tasks?.filter((t) => t.completed).length || 0;
  const totalTasks = project.tasks?.length || 0;

  const relatedProjects = allProjects?.filter(p => p.source_client_id === project.id) || [];
  const projectTypesForCreate = projectTypes?.filter(pt => pt.name !== 'Client') || [];

  const fundingProjectTypeId = projectTypes?.find(pt => pt.name === 'Funding Project')?.id;
  const comSecProjectTypeId = projectTypes?.find(pt => pt.name === 'Com Sec')?.id;

  const relatedFundingProjects = relatedProjects.filter(p => p.project_type_id === fundingProjectTypeId);
  const relatedComSecProjects = relatedProjects.filter(p => p.project_type_id === comSecProjectTypeId);

  const isFundingProject = projectTypes?.find(pt => pt.id === project.project_type_id)?.name === 'Funding Project';

  const upcomingTasks = project.tasks?.filter(task => {
    if (!task.deadline || task.completed) return false;
    if (!task.assigned_to || task.assigned_to !== currentUserId) return false;
    const daysUntilDue = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  }) || [];

  const pastDueTasks = project.tasks?.filter(task => {
    if (!task.deadline || task.completed) return false;
    if (!task.assigned_to || task.assigned_to !== currentUserId) return false;
    const daysUntilDue = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue < 0;
  }) || [];

  const hasUpcomingDeadline = isFundingProject && upcomingTasks.length > 0;
  const hasPastDueTasks = isFundingProject && pastDueTasks.length > 0;

  function getProjectTypeAndStatus(proj: Project) {
    const type = projectTypes?.find(pt => pt.id === proj.project_type_id);
    const status = statuses?.find(s => s.id === proj.status_id);
    return { type: type?.name, status: status?.name };
  }

  function getSubstatusIconColor(statusName: string): { bg: string; text: string } {
    const colorMap: { [key: string]: { bg: string; text: string } } = {
      'Hi-Po': { bg: 'bg-red-900', text: 'text-white' },
      'Mid-Po': { bg: 'bg-red-600', text: 'text-white' },
      'Lo-Po': { bg: 'bg-red-300', text: 'text-slate-900' },
      'Cold Call': { bg: 'bg-teal-500', text: 'text-white' },
      'Q&A': { bg: 'bg-blue-900', text: 'text-white' },
      'Q&A -EMF': { bg: 'bg-blue-600', text: 'text-white' },
      '已上委員會': { bg: 'bg-blue-300', text: 'text-slate-900' },
      'Presbmission': { bg: 'bg-yellow-400', text: 'text-slate-900' },
      'Approved': { bg: 'bg-orange-300', text: 'text-slate-900' },
      'Final Report': { bg: 'bg-purple-300', text: 'text-slate-900' },
      'Conditional Approval': { bg: 'bg-green-300', text: 'text-slate-900' },
      'Final Report (Q&A)': { bg: 'bg-pink-400', text: 'text-white' },
      'Extension/Change Request': { bg: 'bg-green-700', text: 'text-white' },
      'Final Report-Final Stage': { bg: 'bg-red-600', text: 'text-white' },
      'Withdraw': { bg: 'bg-slate-400', text: 'text-white' },
      'Rejected': { bg: 'bg-slate-900', text: 'text-white' },
      'End': { bg: 'bg-slate-900', text: 'text-white' }
    };
    return colorMap[statusName] || { bg: 'bg-slate-200', text: 'text-slate-800' };
  }

  const currentStatus = statuses?.find(s => s.id === project.status_id);
  const statusIconColor = currentStatus ? getSubstatusIconColor(currentStatus.name) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div
        draggable
        onDragStart={onDragStart}
        onClick={onClick}
        className="p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isFundingProject && statusIconColor && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${statusIconColor.bg} ${statusIconColor.text}`} title={currentStatus?.name}>
                  <CircleDot className="w-3.5 h-3.5" />
                </span>
              )}
              <h3 className="font-medium text-slate-900">{project.title}</h3>
              {hasPastDueTasks && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 px-2 py-1 rounded-md shadow-sm">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {pastDueTasks.length} overdue
                </span>
              )}
              {hasUpcomingDeadline && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-800 bg-orange-100 px-2 py-1 rounded-md border border-orange-300">
                  <Bell className="w-3.5 h-3.5" />
                  {upcomingTasks.length} due soon
                </span>
              )}
              {!isFundingProject && !showSubstatus && project.status_id && (
                <span className="inline-block text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {statuses?.find(s => s.id === project.status_id)?.name}
                </span>
              )}
              {isFundingProject && project.invoice_number && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200" title="Invoice issued">
                  <FileText className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
            {project.project_name && (
              <p className="text-xs text-slate-600 mt-0.5">{project.project_name}</p>
            )}
            {showSubstatus && project.status_id && (
              <span className="inline-block text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded mt-1">
                {statuses?.find(s => s.id === project.status_id)?.name}
              </span>
            )}
          </div>
          {project.clients && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClientClick?.(project.clients!);
              }}
              className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded ml-2 flex-shrink-0 hover:bg-blue-100 transition-colors"
            >
              #{project.clients.client_number}
            </button>
          )}
          {isFundingProject && project.client_number && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded ml-2 flex-shrink-0">
              {project.client_number}
            </span>
          )}
          {isFundingProject && project.project_reference && (
            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded ml-2 flex-shrink-0">
              {project.project_reference}
            </span>
          )}
        </div>
        {project.clients && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClientClick?.(project.clients!);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline mb-2 text-left"
          >
            {project.clients.name}
          </button>
        )}
        {project.labels && project.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {project.labels.map(label => (
              <div
                key={label.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: label.color }}
              >
                <Tag className="w-2.5 h-2.5" />
                {label.name}
              </div>
            ))}
          </div>
        )}
        {!isFundingProject && project.description && (
          <p className="text-sm text-slate-600 mb-3 line-clamp-2">{project.description}</p>
        )}

        <ProjectCardFields project={project} />
        {!isFundingProject && totalTasks > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
              {completedTasks === totalTasks ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
              <span className="font-medium">
                {completedTasks}/{totalTasks} tasks
              </span>
            </div>
            <div className="space-y-1.5">
              {project.tasks?.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-start gap-2 text-xs">
                  {task.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`truncate ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.deadline && (
                        <span className={`text-xs ${
                          new Date(task.deadline) < new Date() && !task.completed
                            ? 'text-red-600 font-medium'
                            : 'text-slate-500'
                        }`}>
                          Due: {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                      {task.staff && (
                        <>
                          {task.deadline && <span className="text-slate-300">•</span>}
                          <span className="text-slate-500">
                            {task.staff.full_name || task.staff.email}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(project.tasks?.length || 0) > 3 && (
                <p className="text-xs text-slate-500 pl-5">
                  + {(project.tasks?.length || 0) - 3} more task{(project.tasks?.length || 0) - 3 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {isClientSection && (relatedFundingProjects.length > 0 || relatedComSecProjects.length > 0) && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            {relatedFundingProjects.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-slate-500 mb-1">Funding Projects:</p>
                <div className="space-y-1">
                  {relatedFundingProjects.map(relatedProj => {
                    const { status } = getProjectTypeAndStatus(relatedProj);
                    return (
                      <div key={relatedProj.id} className="text-xs text-slate-600 flex items-center gap-1">
                        <span className="font-medium">{relatedProj.project_reference || relatedProj.title}</span>
                        <span className="text-slate-400">•</span>
                        <span>{status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {relatedComSecProjects.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">ComSec Projects:</p>
                <div className="space-y-1">
                  {relatedComSecProjects.map(relatedProj => {
                    const { status } = getProjectTypeAndStatus(relatedProj);
                    return (
                      <div key={relatedProj.id} className="text-xs text-slate-600 flex items-center gap-1">
                        <span className="font-medium">{relatedProj.title}</span>
                        <span className="text-slate-400">•</span>
                        <span>{status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isClientSection && onCreateProject && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium flex items-center justify-center gap-2 transition-colors border-t border-blue-200"
          >
            <span>Create Project</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                {projectTypesForCreate.map(type => (
                  <button
                    key={type.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateProject(type.id);
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
