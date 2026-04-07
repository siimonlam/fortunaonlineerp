import { useState, useEffect } from 'react';
import { FileText, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  main_project_grant_amount: number;
  sub_project_completed_amount: number;
  main_project_completed_amount: number;
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
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden border border-slate-200">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-700 w-8 text-right">{clamped}%</span>
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
      const { error } = await supabase
        .from('funding_project_details')
        .delete()
        .eq('id', id);

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

  const handleRefresh = () => {
    loadDetails();
    if (onRefresh) onRefresh();
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

  if (details.length === 0) {
    return null;
  }

  const totalGrantAmount = details.reduce((sum, d) => sum + (d.sub_project_grant_amount || 0), 0);
  const totalCompletedAmount = details.reduce((sum, d) => sum + (d.sub_project_completed_amount || 0), 0);
  const fundingSought = details[0]?.funding_sought || 0;
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
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-semibold text-slate-900">
            Project Budget Details
            <span className="ml-2 text-sm font-normal text-slate-500">({details.length} items)</span>
          </h3>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide w-10">Item</th>
              <th className="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide min-w-[160px]">Main Project</th>
              <th className="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide min-w-[140px]">Sub Project</th>
              <th className="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide min-w-[200px]">Details</th>
              <th className="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs uppercase tracking-wide w-20">Qty</th>
              <th className="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs uppercase tracking-wide min-w-[120px]">Completion</th>
              <th className="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs uppercase tracking-wide w-28">Grant Amount</th>
              <th className="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs uppercase tracking-wide w-14"></th>
            </tr>
          </thead>
          <tbody>
            {mainProjectOrder.map((mainProject, groupIndex) => {
              const rows = groupedByMain[mainProject];
              const groupBg = groupIndex % 2 === 0 ? 'bg-blue-50/40' : 'bg-green-50/30';
              const groupGrantTotal = rows.reduce((s, r) => s + (r.sub_project_grant_amount || 0), 0);
              const groupCompletedTotal = rows.reduce((s, r) => s + (r.sub_project_completed_amount || 0), 0);

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
                    className={`${groupBg} ${isLastInGroup ? 'border-b-2 border-slate-300' : 'border-b border-slate-200'} hover:brightness-95 transition-all`}
                  >
                    <td className="px-3 py-2.5 text-slate-500 text-xs font-mono text-center">
                      {currentCounter}
                    </td>
                    <td className={`px-3 py-2.5 text-slate-800 font-medium text-xs leading-relaxed ${isFirstInGroup ? 'pt-3' : ''}`}>
                      {isFirstInGroup ? (
                        <div>
                          <div>{detail.main_project}</div>
                          {rows.length > 1 && isLastInGroup && (
                            <div className="mt-1 text-right text-slate-500 font-normal text-xs">
                              Subtotal: ${groupGrantTotal.toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : isLastInGroup && rows.length > 1 ? (
                        <div className="text-right text-slate-500 font-normal text-xs pt-1">
                          Subtotal: ${groupGrantTotal.toLocaleString()}
                          {groupCompletedTotal > 0 && (
                            <span className="ml-1 text-green-700">(${groupCompletedTotal.toLocaleString()} completed)</span>
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-slate-900 text-xs font-medium">{detail.sub_project}</td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs leading-relaxed max-w-xs whitespace-pre-wrap">{detail.details}</td>
                    <td className="px-3 py-2.5 text-slate-700 text-xs text-right font-mono">
                      {detail.sub_project_approved_qty != null ? detail.sub_project_approved_qty.toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <CompletionBar percent={completionPct} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-800 text-xs text-right font-semibold font-mono">
                      {detail.sub_project_grant_amount != null
                        ? `$${detail.sub_project_grant_amount.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleDelete(detail.id)}
                        disabled={deleting === detail.id}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === detail.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300">
              <td colSpan={5} className="px-3 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Total ({details.length} items)
              </td>
              <td className="px-3 py-3">
                <CompletionBar percent={overallPercent} />
              </td>
              <td className="px-3 py-3 text-right text-sm font-bold text-slate-900 font-mono">
                ${totalGrantAmount.toLocaleString()}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Enterprise</p>
            <p className="font-semibold text-slate-800 text-xs">{details[0]?.enterprise_name_en || '-'}</p>
            {details[0]?.enterprise_name_zh && (
              <p className="text-slate-600 text-xs">{details[0].enterprise_name_zh}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">BR Number</p>
            <p className="font-semibold text-slate-800 text-xs font-mono">{details[0]?.br_number || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Project Period</p>
            <p className="font-semibold text-slate-800 text-xs">
              {details[0]?.project_start_date
                ? `${details[0].project_start_date} – ${details[0].project_end_date || '?'}`
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Funding Sought</p>
            <p className="font-bold text-blue-700 text-sm font-mono">
              {fundingSought ? `$${fundingSought.toLocaleString()}` : '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
