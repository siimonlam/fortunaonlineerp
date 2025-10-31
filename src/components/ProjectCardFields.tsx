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
        <Building2 className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Company:</span>
        <span className="truncate">{project.company_name || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <User className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Contact:</span>
        <span className="truncate">{project.contact_name || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="font-medium">Tel:</span>
        <span>{project.contact_number || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="font-medium">Email:</span>
        <span className="truncate">{project.email || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="font-medium">Address:</span>
        <span className="truncate">{project.address || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-700">
        <Hash className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Abbr:</span>
        <span className="font-medium">{project.abbreviation || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <FileText className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">App #:</span>
        <span>{project.application_number || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <Package className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Size:</span>
        <span>{project.project_size || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="font-medium">Source:</span>
        <span>{project.sales_source || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-700">
        <DollarSign className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Deposit:</span>
        <span className="font-medium">{project.deposit_amount ? `$${project.deposit_amount.toLocaleString()}` : '-'}</span>
        {project.deposit_paid && (
          <span className="text-green-600 font-medium">(Paid)</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="font-medium">Service Fee:</span>
        <span>{project.service_fee_percentage ? `${project.service_fee_percentage}%` : '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="font-medium">Invoice:</span>
        <span>{project.invoice_number || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="font-medium">Agreement:</span>
        <span>{project.agreement_ref || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="font-medium">WhatsApp:</span>
        <span className="truncate">{project.whatsapp_group_id || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Start:</span>
        <span>{project.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Project Period:</span>
        <span>
          {project.project_start_date ? new Date(project.project_start_date).toLocaleDateString() : '-'}
          {project.project_end_date && ` - ${new Date(project.project_end_date).toLocaleDateString()}`}
        </span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="font-medium">Submitted:</span>
        <span>{project.submission_date ? new Date(project.submission_date).toLocaleDateString() : '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-green-700">
        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Approved:</span>
        <span>{project.approval_date ? new Date(project.approval_date).toLocaleDateString() : '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-orange-600">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">Next Due:</span>
        <span>{project.next_due_date ? new Date(project.next_due_date).toLocaleDateString() : '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-orange-600">
        <span className="font-medium">HKPC Due:</span>
        <span>{project.next_hkpc_due_date ? new Date(project.next_hkpc_due_date).toLocaleDateString() : '-'}</span>
      </div>
    </div>
  );
}
