import { Building2, FileText, Package, Calendar, Clock, DollarSign } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  deadline?: string;
}

interface Project {
  id?: string;
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
  deposit_paid_date?: string;
  service_fee_percentage?: number;
  funding_scheme?: number;
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
  tasks?: Task[];
}

interface ProjectCardFieldsProps {
  project: Project;
}

export function ProjectCardFields({ project }: ProjectCardFieldsProps) {
  const [receivable, setReceivable] = useState<number | null>(null);

  const incompleteTasks = project.tasks?.filter(t => !t.completed && t.deadline) || [];
  const nextUpcomingTask = incompleteTasks
    .filter(t => new Date(t.deadline!) >= new Date())
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0];

  useEffect(() => {
    async function calculateReceivable() {
      if (!project.id) return;

      const projectSize = parseFloat(project.project_size || '0');

      if (projectSize === 0) {
        setReceivable(0);
        return;
      }

      const fundingScheme = project.funding_scheme || 0;
      const serviceFee = project.service_fee_percentage || 0;

      const { data: invoices } = await supabase
        .from('funding_invoice')
        .select('amount')
        .eq('project_id', project.id)
        .eq('payment_status', 'Paid');

      const totalPaid = invoices?.reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0) || 0;
      const calculated = (projectSize * fundingScheme / 100 * serviceFee / 100) - totalPaid;

      setReceivable(calculated);
    }

    calculateReceivable();
  }, [project.id, project.project_size, project.funding_scheme, project.service_fee_percentage]);

  return (
    <div className="space-y-1.5 mb-3 text-xs">
      <div className="flex items-center gap-2 text-slate-600">
        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium truncate">{project.company_name || 'No company name'}</span>
      </div>

      {project.application_number && (
        <div className="flex items-center gap-2 text-slate-600">
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">App #:</span>
          <span>{project.application_number}</span>
        </div>
      )}

      {project.next_hkpc_due_date && (
        <div className="flex items-center gap-2 text-orange-600">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">HKPC Due:</span>
          <span>{new Date(project.next_hkpc_due_date).toLocaleString()}</span>
        </div>
      )}

      {nextUpcomingTask && (
        <div className="flex items-center gap-2 text-blue-600">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Next Task:</span>
          <span>{new Date(nextUpcomingTask.deadline!).toLocaleString()}</span>
        </div>
      )}

      {(project.project_start_date || project.project_end_date) && (
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Project:</span>
          <span>
            {project.project_start_date ? new Date(project.project_start_date).toLocaleDateString() : '-'}
            {' to '}
            {project.project_end_date ? new Date(project.project_end_date).toLocaleDateString() : '-'}
          </span>
        </div>
      )}

      {project.submission_date && (
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Submission:</span>
          <span>{new Date(project.submission_date).toLocaleDateString()}</span>
        </div>
      )}

      {project.deposit_paid_date && (
        <div className="flex items-center gap-2 text-green-600">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Deposit Paid:</span>
          <span>{new Date(project.deposit_paid_date).toLocaleDateString()}</span>
        </div>
      )}

      {project.project_size && (
        <div className="flex items-center gap-2 text-slate-600">
          <Package className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Size:</span>
          <span>{project.project_size}</span>
        </div>
      )}

      {receivable !== null && (
        <div className={`flex items-center gap-2 ${receivable >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Receivable:</span>
          <span>HKD ${receivable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      )}
    </div>
  );
}
