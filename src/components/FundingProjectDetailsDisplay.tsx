import { useState, useEffect } from 'react';
import { FileText, Trash2, Loader2, RefreshCw, User, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProjectCoordinator {
  name_en?: string;
  name_zh?: string;
  position?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

interface FundingProjectDetail {
  id: string;
  item_number: string;
  project_reference: string;
  enterprise_name_en: string;
  enterprise_name_zh: string;
  br_number: string;
  project_start_date: string;
  project_end_date: string;
  total_project_cost: number;
  funding_sought: number;
  main_project: string;
  sub_project: string;
  details: string;
  sub_project_approved_qty: number;
  sub_project_completed_qty: number;
  completed_percent: number;
  sub_project_unit_price: number;
  sub_project_grant_amount: number;
  item_grant_amount: number | null;
  main_project_grant_amount: number;
  sub_project_completed_amount: number;
  main_project_completed_amount: number;
  project_coordinator: ProjectCoordinator | null;
  deputy_project_coordinator: ProjectCoordinator | null;
  created_at: string;
}

interface FundingProjectDetailsDisplayProps {
  projectId: string;
  onRefresh?: () => void;
}

function CompletionBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent || 0));
  const color =
    clamped === 100
      ? 'bg-green-500'
      : clamped >= 50
      ? 'bg-green-400'
      : clamped > 0
      ? 'bg-yellow-400'
      : 'bg-slate-200';

  return (
    <div className="flex items-center gap-1.5 min-w-[90px]">
      <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden border border-slate-200">
        <div className={`h-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-700 w-8 text-right shrink-0">{clamped}%</span>
    </div>
  );
}

function CoordinatorCard({ label, person, icon }: { label: string; person: ProjectCoordinator | null; icon: React.ReactNode }) {
  if (!person || (!person.name_en && !person.name_zh)) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-slate-500">{icon}</span>
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
      </div>
      {person.name_en && <p className="text-sm font-semibold text-slate-900">{person.name_en}</p>}
      {person.name_zh && <p className="text-xs text-slate-600">{person.name_zh}</p>}
      {person.position && <p className="text-xs text-slate-500 mt-0.5">{person.position}</p>}
      <div className="mt-1.5 space-y-0.5">
        {person.phone && (
          <p className="text-xs text-slate-500">
            <span className="text-slate-400">Tel: </span>{person.phone}
          </p>
        )}
        {person.fax && (
          <p className="text-xs text-slate-500">
            <span className="text-slate-400">Fax: </span>{person.fax}
          </p>
        )}
        {person.email && (
          <p className="text-xs text-blue-600 truncate">{person.email}</p>
        )}
      </div>
    </div>
  );
}

export function FundingProjectDetailsDisplay({ projectId, onRefresh }: FundingProjectDetailsDisplayProps) {
  const [details, setDetails] = useState<FundingProjectDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('funding_project_details')
        .select('*')
        .eq('project_id', projectId)
        .order('item_number', { ascending: true });

      if (error) throw error;
      setDetails(data || []);
    } catch (error) {
      console.error('Error loading project details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [projectId]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this detail record?')) return;
    try {
      setDeleting(id);
      const { error } = await supabase.from('funding_project_details').delete().eq('id', id);
      if (error) throw error;
      await loadDetails();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error deleting detail:', error);
      alert('Failed to delete detail record');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (details.length === 0) return null;

  const first = details[0];
  const totalGrantAmount = details.reduce((sum, d) => sum + (d.sub_project_grant_amount || 0), 0);
  const totalCompletedAmount = details.reduce((sum, d) => sum + (d.sub_project_completed_amount || 0), 0);
  const overallPercent = totalGrantAmount > 0 ? Math.round((totalCompletedAmount / totalGrantAmount) * 100) : 0;

  const groupedByMain: Record<string, FundingProjectDetail[]> = {};
  const mainProjectOrder: string[] = [];
  for (const d of details) {
    if (!groupedByMain[d.main_project]) {
      groupedByMain[d.main_project] = [];
      mainProjectOrder.push(d.main_project);
    }
    groupedByMain[d.main_project].push(d);
  }

  let itemCounter = 0;

  return (
    <div className="space-y-4">

      {/* Project Detail Summary */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Project Detail Summary</h3>
        </div>
        <div className="p-5 space-y-4">
          {/* Company + Dates + Financials grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Company Name (EN)</p>
              <p className="text-sm font-semibold text-slate-900">{first.enterprise_name_en || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Company Name (CN)</p>
              <p className="text-sm font-semibold text-slate-900">{first.enterprise_name_zh || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Project Start Date</p>
              <p className="text-sm font-semibold text-slate-900">{first.project_start_date || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Project End Date</p>
              <p className="text-sm font-semibold text-slate-900">{first.project_end_date || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Total Granted Amount (Funding Sought)</p>
              <p className="text-sm font-bold text-blue-700 font-mono">
                {first.funding_sought ? `$${first.funding_sought.toLocaleString()}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Total Project Cost</p>
              <p className="text-sm font-bold text-slate-900 font-mono">
                {first.total_project_cost ? `$${first.total_project_cost.toLocaleString()}` : '-'}
              </p>
            </div>
          </div>

          {/* Coordinators */}
          {(first.project_coordinator || first.deputy_project_coordinator) && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <CoordinatorCard
                label="Project Coordinator"
                person={first.project_coordinator}
                icon={<User className="w-3.5 h-3.5" />}
              />
              <CoordinatorCard
                label="Deputy Project Coordinator"
                person={first.deputy_project_coordinator}
                icon={<Users className="w-3.5 h-3.5" />}
              />
            </div>
          )}
        </div>
      </div>

      {/* Budget Details Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Project Budget Details
              <span className="ml-2 font-normal text-slate-400 normal-case">({details.length} items)</span>
            </h3>
          </div>
          <button
            onClick={() => { loadDetails(); if (onRefresh) onRefresh(); }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-center font-semibold text-slate-500 text-xs uppercase tracking-wide w-10">No.</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide min-w-[150px]">Main Project</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide min-w-[130px]">Sub Project</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide min-w-[180px]">Details</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide w-14">Qty</th>
                <th className="px-3 py-2.5 text-center font-semibold text-slate-500 text-xs uppercase tracking-wide min-w-[110px]">Completion</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide w-28">Sub Grant Amt</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide w-28 bg-amber-50">Item Grant Amt</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide w-28 bg-blue-50">Subtotal</th>
                <th className="px-2 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {mainProjectOrder.map((mainProject, groupIndex) => {
                const rows = groupedByMain[mainProject];
                const groupBg = groupIndex % 2 === 0 ? 'bg-blue-50/30' : 'bg-green-50/25';
                const groupGrantTotal = rows.reduce((s, r) => s + (r.sub_project_grant_amount || 0), 0);

                return rows.map((detail, rowIndex) => {
                  itemCounter += 1;
                  const currentCounter = itemCounter;
                  const isFirstInGroup = rowIndex === 0;
                  const isLastInGroup = rowIndex === rows.length - 1;
                  const completionPct = detail.sub_project_grant_amount > 0
                    ? Math.round(((detail.sub_project_completed_amount || 0) / detail.sub_project_grant_amount) * 100)
                    : (detail.completed_percent || 0);

                  return (
                    <tr
                      key={detail.id}
                      className={`${groupBg} ${isLastInGroup ? 'border-b-2 border-slate-300' : 'border-b border-slate-100'} hover:brightness-[0.97] transition-all`}
                    >
                      <td className="px-3 py-2 text-slate-400 text-xs font-mono text-center">{currentCounter}</td>
                      <td className="px-3 py-2 text-slate-800 font-medium text-xs leading-snug">
                        {isFirstInGroup ? detail.main_project : ''}
                      </td>
                      <td className="px-3 py-2 text-slate-800 text-xs">{detail.sub_project}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs leading-relaxed max-w-[200px] whitespace-pre-wrap">{detail.details}</td>
                      <td className="px-3 py-2 text-slate-700 text-xs text-right font-mono">
                        {detail.sub_project_approved_qty != null ? detail.sub_project_approved_qty : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <CompletionBar percent={completionPct} />
                      </td>
                      <td className="px-3 py-2 text-slate-800 text-xs text-right font-mono">
                        {detail.sub_project_grant_amount != null
                          ? `$${detail.sub_project_grant_amount.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-3 py-2 bg-amber-50/50 text-right">
                        {detail.item_grant_amount != null ? (
                          <span className="text-xs font-semibold text-amber-700 font-mono">
                            ${detail.item_grant_amount.toLocaleString()}
                          </span>
                        ) : null}
                      </td>
                      {/* Subtotal column — only shown on last row of group, spans visually */}
                      <td className="px-3 py-2 bg-blue-50/60 text-right">
                        {isLastInGroup ? (
                          <span className="text-xs font-bold text-blue-700 font-mono">
                            ${groupGrantTotal.toLocaleString()}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleDelete(detail.id)}
                          disabled={deleting === detail.id}
                          className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        >
                          {deleting === detail.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />}
                        </button>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td colSpan={5} className="px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Grand Total ({details.length} items)
                </td>
                <td className="px-3 py-2.5">
                  <CompletionBar percent={overallPercent} />
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-900 font-mono">
                  ${totalGrantAmount.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 bg-amber-50" />
                <td className="px-3 py-2.5 bg-blue-100 text-right text-sm font-bold text-blue-800 font-mono">
                  ${totalGrantAmount.toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
