import { useState } from 'react';
import { CheckCircle2, Circle, Building2, User, ChevronDown, Calendar, DollarSign, FileText, Hash, Package } from 'lucide-react';

interface Task {
  id: string;
  completed: boolean;
}

interface Client {
  id: string;
  name: string;
  client_number: number;
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
  showSubstatus?: boolean;
  onDragStart: () => void;
  onClick: () => void;
  onCreateProject?: (projectTypeId: string) => void;
}

export function ProjectCard({
  project,
  isClientSection,
  projectTypes,
  statuses,
  allProjects,
  showSubstatus = false,
  onDragStart,
  onClick,
  onCreateProject
}: ProjectCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const completedTasks = project.tasks?.filter((t) => t.completed).length || 0;
  const totalTasks = project.tasks?.length || 0;

  const relatedProjects = allProjects?.filter(p => p.source_client_id === project.id) || [];
  const projectTypesForCreate = projectTypes?.filter(pt => pt.name !== 'Client') || [];

  function getProjectTypeAndStatus(proj: Project) {
    const type = projectTypes?.find(pt => pt.id === proj.project_type_id);
    const status = statuses?.find(s => s.id === proj.status_id);
    return { type: type?.name, status: status?.name };
  }

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
            <h3 className="font-medium text-slate-900">{project.title}</h3>
            {showSubstatus && project.status_id && (
              <span className="inline-block text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded mt-1">
                {statuses?.find(s => s.id === project.status_id)?.name}
              </span>
            )}
          </div>
          {project.clients && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded ml-2 flex-shrink-0">
              #{String(project.clients.client_number).padStart(4, '0')}
            </span>
          )}
        </div>
        {project.clients && (
          <p className="text-xs text-slate-500 mb-2">{project.clients.name}</p>
        )}
        {project.description && (
          <p className="text-sm text-slate-600 mb-3 line-clamp-2">{project.description}</p>
        )}

        <div className="space-y-1.5 mb-3 text-xs">
          {project.company_name && (
            <div className="flex items-center gap-2 text-slate-600">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{project.company_name}</span>
            </div>
          )}
          {project.contact_name && (
            <div className="flex items-center gap-2 text-slate-600">
              <User className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{project.contact_name}</span>
            </div>
          )}
          {project.contact_number && (
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-medium">Tel:</span>
              <span>{project.contact_number}</span>
            </div>
          )}
          {project.abbreviation && (
            <div className="flex items-center gap-2 text-slate-700">
              <Hash className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium">{project.abbreviation}</span>
            </div>
          )}
          {project.application_number && (
            <div className="flex items-center gap-2 text-slate-600">
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium">App #:</span>
              <span>{project.application_number}</span>
            </div>
          )}
          {project.project_size && (
            <div className="flex items-center gap-2 text-slate-600">
              <Package className="w-3 h-3 flex-shrink-0" />
              <span>{project.project_size}</span>
            </div>
          )}
          {project.deposit_amount && (
            <div className="flex items-center gap-2 text-slate-700">
              <DollarSign className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium">${project.deposit_amount.toLocaleString()}</span>
              {project.deposit_paid && (
                <span className="text-green-600 font-medium">(Paid)</span>
              )}
            </div>
          )}
          {project.project_start_date && (
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span>{new Date(project.project_start_date).toLocaleDateString()}</span>
              {project.project_end_date && (
                <span>- {new Date(project.project_end_date).toLocaleDateString()}</span>
              )}
            </div>
          )}
          {project.submission_date && (
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-medium">Submitted:</span>
              <span>{new Date(project.submission_date).toLocaleDateString()}</span>
            </div>
          )}
          {project.approval_date && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium">Approved:</span>
              <span>{new Date(project.approval_date).toLocaleDateString()}</span>
            </div>
          )}
          {project.next_due_date && (
            <div className="flex items-center gap-2 text-orange-600">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium">Next Due:</span>
              <span>{new Date(project.next_due_date).toLocaleDateString()}</span>
            </div>
          )}
          {project.invoice_number && (
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-medium">Invoice:</span>
              <span>{project.invoice_number}</span>
            </div>
          )}
        </div>
        {totalTasks > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {completedTasks === totalTasks ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
            <span>
              {completedTasks}/{totalTasks} tasks
            </span>
          </div>
        )}

        {isClientSection && relatedProjects.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-2">Related Projects:</p>
            <div className="space-y-1">
              {relatedProjects.map(relatedProj => {
                const { type, status } = getProjectTypeAndStatus(relatedProj);
                return (
                  <div key={relatedProj.id} className="text-xs text-slate-600 flex items-center gap-1">
                    <span className="font-medium">{type}</span>
                    <span className="text-slate-400">•</span>
                    <span>{status}</span>
                  </div>
                );
              })}
            </div>
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
