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

interface SubProjectGroup {
  subProjectName: string;
  subProjectGrantAmount: number;
  subProjectQty: number | null;
  items: FundingProjectDetail[];
  hasItems: boolean;
}

interface MainProjectGroup {
  mainProjectName: string;
  mainProjectGrantAmount: number;
  subProjects: SubProjectGroup[];
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
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-3.5 bg-slate-100 rounded overflow-hidden border border-slate-200">
        <div className={`h-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 w-7 text-right shrink-0">{clamped}%</span>
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

// Strip "細項 N: " prefix and trailing "(HK$X,XXX.XX)" or "(HKS...)" amounts
function cleanDetailText(text: string): string {
  if (!text) return text;
  // Remove leading "細項 N:" or "細項N:" prefix
  let cleaned = text.replace(/^細項\s*\d+\s*[:：]\s*/u, '');
  // Remove trailing amount like "(HK$9,000.00)" or "(HKS51,000.00)" or "(HK$ 9,000)"
  cleaned = cleaned.replace(/\s*\(HK[S$]\$?\s?[\d,]+(?:\.\d+)?\)\s*$/i, '');
  return cleaned.trim();
}

function groupDetails(details: FundingProjectDetail[]): MainProjectGroup[] {
  const mainOrder: string[] = [];
  const mainMap: Record<string, { rows: FundingProjectDetail[]; grantAmount: number }> = {};

  for (const d of details) {
    if (!mainMap[d.main_project]) {
      mainMap[d.main_project] = { rows: [], grantAmount: d.main_project_grant_amount || 0 };
      mainOrder.push(d.main_project);
    }
    mainMap[d.main_project].rows.push(d);
  }

  return mainOrder.map(mainName => {
    const { rows, grantAmount } = mainMap[mainName];

    const subOrder: string[] = [];
    const subMap: Record<string, FundingProjectDetail[]> = {};

    for (const d of rows) {
      if (!subMap[d.sub_project]) {
        subMap[d.sub_project] = [];
        subOrder.push(d.sub_project);
      }
      subMap[d.sub_project].push(d);
    }

    const subProjects: SubProjectGroup[] = subOrder.map(subName => {
      const subRows = subMap[subName];
      // Deduplicate: if the same sub_project appears multiple times, prefer the row(s) with 細項 data
      const parentRow = subRows.find(r => r.item_grant_amount === 0) ||
                        subRows.find(r => r.item_grant_amount == null) ||
                        subRows[0];
      // Deduplicate 細項 child rows by item_grant_amount value to prevent double entries
      const seenAmounts = new Set<number>();
      const itemRows = subRows.filter(r => {
        if (r.item_grant_amount == null || r.item_grant_amount === 0) return false;
        if (seenAmounts.has(r.item_grant_amount)) return false;
        seenAmounts.add(r.item_grant_amount);
        return true;
      });
      const hasItems = itemRows.length > 0;
      const displayRows = hasItems ? [parentRow, ...itemRows] : [parentRow];

      return {
        subProjectName: subName,
        subProjectGrantAmount: parentRow.sub_project_grant_amount || 0,
        subProjectQty: parentRow.sub_project_approved_qty ?? null,
        items: displayRows,
        hasItems,
      };
    });

    return {
      mainProjectName: mainName,
      mainProjectGrantAmount: grantAmount,
      subProjects,
    };
  });
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
  const grouped = groupDetails(details);

  const totalGrantAmount = grouped.reduce((sum, mp) => sum + mp.mainProjectGrantAmount, 0);
  const totalCompletedAmount = details.reduce((sum, d) => d.item_grant_amount == null ? sum + (d.sub_project_completed_amount || 0) : sum, 0);
  const overallPercent = totalGrantAmount > 0 ? Math.round((totalCompletedAmount / totalGrantAmount) * 100) : 0;
  const totalSubProjectCount = grouped.reduce((sum, mp) => sum + mp.subProjects.length, 0);

  let subProjectCounter = 0;

  return (
    <div className="space-y-4">

      {/* Project Detail Summary */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Project Detail Summary</h3>
        </div>
        <div className="p-5 space-y-4">
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
              <span className="ml-2 font-normal text-slate-400 normal-case">({totalSubProjectCount} sub-projects)</span>
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
          <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '32px' }} />
              <col style={{ width: '140px', minWidth: '100px' }} />
              <col style={{ width: '160px', minWidth: '100px' }} />
              <col style={{ width: '260px', minWidth: '150px' }} />
              <col style={{ width: '44px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '32px' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-2 py-2 text-center font-semibold text-slate-500 text-xs uppercase tracking-wide">No.</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide overflow-hidden" style={{ resize: 'horizontal' }}>Main Project</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide overflow-hidden" style={{ resize: 'horizontal' }}>Sub Project</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-500 text-xs uppercase tracking-wide overflow-hidden" style={{ resize: 'horizontal' }}>Details (細項)</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-500 text-xs uppercase tracking-wide">Qty</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-500 text-xs uppercase tracking-wide">Completion</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide bg-amber-50">Sub Grant</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide bg-amber-50/60">Item Grant</th>
                <th className="px-2 py-2 text-right font-semibold text-slate-500 text-xs uppercase tracking-wide bg-blue-50">Subtotal</th>
                <th className="px-1 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((mainGroup, groupIndex) => {
                const groupBg = groupIndex % 2 === 0 ? 'bg-blue-50/30' : 'bg-green-50/25';
                const totalSubRows = mainGroup.subProjects.reduce((s, sp) => s + sp.items.length, 0);
                let mainProjectRendered = false;
                const mainRowSpan = totalSubRows;

                return mainGroup.subProjects.map((subProject) => {
                  subProjectCounter += 1;
                  const currentCounter = subProjectCounter;
                  const isLastSubInMain = subProject === mainGroup.subProjects[mainGroup.subProjects.length - 1];

                  return subProject.items.map((item, itemIndex) => {
                    const isFirstItemOfSub = itemIndex === 0;
                    const isLastItemOfSub = itemIndex === subProject.items.length - 1;
                    const isLastRowOfMain = isLastSubInMain && isLastItemOfSub;
                    const isItemRow = item.item_grant_amount != null && item.item_grant_amount > 0;

                    const displayItemGrantAmount = !subProject.hasItems
                      ? subProject.subProjectGrantAmount
                      : isItemRow
                      ? item.item_grant_amount
                      : null;

                    const completionPct = subProject.subProjectGrantAmount > 0
                      ? Math.round(((item.sub_project_completed_amount || 0) / subProject.subProjectGrantAmount) * 100)
                      : (item.completed_percent || 0);

                    const showMainProject = !mainProjectRendered;
                    if (showMainProject) mainProjectRendered = true;

                    const detailText = cleanDetailText(item.details || '');

                    return (
                      <tr
                        key={item.id}
                        className={`${groupBg} ${isLastRowOfMain ? 'border-b-2 border-slate-300' : isLastItemOfSub ? 'border-b border-slate-200' : 'border-b border-slate-100'} hover:brightness-[0.97] transition-all`}
                      >
                        {isFirstItemOfSub && (
                          <td
                            className="px-2 py-1.5 text-slate-400 text-xs font-mono text-center align-top"
                            rowSpan={subProject.items.length}
                          >
                            {currentCounter}
                          </td>
                        )}

                        {showMainProject && (
                          <td
                            className="px-2 py-1.5 text-slate-800 font-semibold text-xs leading-snug align-top border-r border-slate-200 overflow-hidden"
                            rowSpan={mainRowSpan}
                            style={{ wordBreak: 'break-word' }}
                          >
                            <span className="underline">{mainGroup.mainProjectName}</span>
                          </td>
                        )}

                        {isFirstItemOfSub && (
                          <td
                            className="px-2 py-1.5 text-slate-700 text-xs leading-snug align-top overflow-hidden"
                            rowSpan={subProject.items.length}
                            style={{ wordBreak: 'break-word' }}
                          >
                            {subProject.subProjectName}
                          </td>
                        )}

                        <td
                          className="px-2 py-1.5 text-xs leading-relaxed overflow-hidden"
                          style={{ wordBreak: 'break-word' }}
                        >
                          {subProject.hasItems ? (
                            isItemRow ? (
                              <span className="text-amber-700 font-medium">{detailText}</span>
                            ) : (
                              <span className="text-slate-500 italic">{detailText || '-'}</span>
                            )
                          ) : (
                            <span className="text-slate-600">{detailText || '-'}</span>
                          )}
                        </td>

                        {isFirstItemOfSub && (
                          <td
                            className="px-2 py-1.5 text-center align-top font-mono text-slate-600"
                            rowSpan={subProject.items.length}
                          >
                            {(subProject.subProjectQty != null && subProject.subProjectQty > 0) ? subProject.subProjectQty : 1}
                          </td>
                        )}

                        {isFirstItemOfSub && (
                          <td
                            className="px-2 py-1.5 align-top"
                            rowSpan={subProject.items.length}
                          >
                            <CompletionBar percent={completionPct} />
                          </td>
                        )}

                        {isFirstItemOfSub && (
                          <td
                            className="px-2 py-1.5 bg-amber-50/40 text-right align-top font-mono text-slate-800"
                            rowSpan={subProject.items.length}
                          >
                            ${subProject.subProjectGrantAmount.toLocaleString()}
                          </td>
                        )}

                        <td className="px-2 py-1.5 bg-amber-50/20 text-right">
                          {displayItemGrantAmount != null ? (
                            <span className="font-semibold text-amber-700 font-mono">
                              ${displayItemGrantAmount.toLocaleString()}
                            </span>
                          ) : null}
                        </td>

                        {showMainProject && (
                          <td
                            className="px-2 py-1.5 bg-blue-50/60 text-right align-top"
                            rowSpan={mainRowSpan}
                          >
                            <span className="font-bold text-blue-700 font-mono">
                              ${mainGroup.mainProjectGrantAmount.toLocaleString()}
                            </span>
                          </td>
                        )}

                        <td className="px-1 py-1.5 text-center">
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deleting === item.id}
                            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          >
                            {deleting === item.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Trash2 className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>
                    );
                  });
                });
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td colSpan={5} className="px-2 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Grand Total ({totalSubProjectCount} sub-projects)
                </td>
                <td className="px-2 py-2">
                  <CompletionBar percent={overallPercent} />
                </td>
                <td className="px-2 py-2 bg-amber-50/40 text-right text-xs font-bold text-slate-900 font-mono">
                  ${totalGrantAmount.toLocaleString()}
                </td>
                <td className="px-2 py-2 bg-amber-50/20" />
                <td className="px-2 py-2 bg-blue-100 text-right text-xs font-bold text-blue-800 font-mono">
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
