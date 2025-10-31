import { Building2, User, Hash, FileText, Package, DollarSign, Calendar, CheckCircle2 } from 'lucide-react';

interface Project {
  company_name?: string;
  contact_name?: string;
  contact_number?: string;
  email?: string;
  address?: string;
  abbreviation?: string;
  application_number?: string;
  project_size?: string;
  sales_source?: string;
  deposit_amount?: number;
  deposit_paid?: boolean;
  service_fee_percentage?: number;
  invoice_number?: string;
  agreement_ref?: string;
  whatsapp_group_id?: string;
  start_date?: string;
  project_start_date?: string;
  project_end_date?: string;
  submission_date?: string;
  approval_date?: string;
  next_due_date?: string;
  next_hkpc_due_date?: string;
}

interface ProjectCardFieldsProps {
  project: Project;
}

export function ProjectCardFields({ project }: ProjectCardFieldsProps) {
  return (
    <div className="space-y-1.5 mb-3 text-xs">
      <div className="flex items-center gap-2 text-slate-600">
        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium truncate">{project.company_name || 'No company name'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <Hash className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{project.abbreviation || 'No abbreviation'}</span>
      </div>
      <div className="flex items-center gap-2 text-orange-600">
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium">Due:</span>
        <span>{project.next_due_date ? new Date(project.next_due_date).toLocaleDateString() : 'No due date'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium">App #:</span>
        <span>{project.application_number || '-'}</span>
      </div>
    </div>
  );
}
