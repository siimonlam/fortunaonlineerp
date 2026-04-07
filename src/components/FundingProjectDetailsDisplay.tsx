import { useState, useEffect } from 'react';
import { FileText, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FundingProjectDetail {
  id: string;
  item_number: number;
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

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            Extracted Project Details ({details.length})
          </h3>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">#</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Main Project</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Sub Project</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Details</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Approved Qty</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Unit Price</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Grant Amount</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {details.map((detail) => (
              <tr key={detail.id} className="hover:bg-slate-50 border-b border-slate-200">
                <td className="px-3 py-2 text-slate-700">{detail.item_number}</td>
                <td className="px-3 py-2 text-slate-900">{detail.main_project}</td>
                <td className="px-3 py-2 text-slate-900">{detail.sub_project}</td>
                <td className="px-3 py-2 text-slate-700 max-w-xs truncate" title={detail.details}>
                  {detail.details}
                </td>
                <td className="px-3 py-2 text-slate-700 text-right">
                  {detail.sub_project_approved_qty?.toLocaleString() || '-'}
                </td>
                <td className="px-3 py-2 text-slate-700 text-right">
                  {detail.sub_project_unit_price
                    ? `$${detail.sub_project_unit_price.toLocaleString()}`
                    : '-'}
                </td>
                <td className="px-3 py-2 text-slate-700 text-right font-medium">
                  {detail.sub_project_grant_amount
                    ? `$${detail.sub_project_grant_amount.toLocaleString()}`
                    : '-'}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleDelete(detail.id)}
                    disabled={deleting === detail.id}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === detail.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Summary</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-600">Total Items</p>
            <p className="font-semibold text-slate-900">{details.length}</p>
          </div>
          <div>
            <p className="text-slate-600">Total Grant Amount</p>
            <p className="font-semibold text-slate-900">
              ${details.reduce((sum, d) => sum + (d.sub_project_grant_amount || 0), 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-slate-600">Total Funding Sought</p>
            <p className="font-semibold text-slate-900">
              ${details.length > 0 && details[0].funding_sought
                ? details[0].funding_sought.toLocaleString()
                : '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
