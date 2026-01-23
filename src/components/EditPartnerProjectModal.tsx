import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface PartnerProject {
  id: string;
  project_reference: string | null;
  channel_partner_id: string | null;
  channel_partner_name: string;
  channel_partner_reference: string | null;
  project_amount: number;
  date: string | null;
  paid_status: boolean;
  commission_rate: number;
  commission_amount: number;
  commission_paid_status: boolean;
  company_name: string | null;
  project_content: string | null;
  project_type?: string;
  project_status?: string;
}

interface EditPartnerProjectModalProps {
  project: PartnerProject;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditPartnerProjectModal({ project, onClose, onSuccess }: EditPartnerProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectReference: project.project_reference || '',
    channelPartnerName: project.channel_partner_name,
    channelPartnerReference: project.channel_partner_reference || '',
    projectAmount: project.project_amount.toString(),
    date: project.date || '',
    paidStatus: project.paid_status,
    commissionRate: project.commission_rate.toString(),
    commissionAmount: project.commission_amount.toString(),
    commissionPaidStatus: project.commission_paid_status,
    companyName: project.company_name || '',
    projectContent: project.project_content || '',
    projectType: project.project_type || 'others',
    projectStatus: project.project_status || 'pending',
  });

  function calculateCommissionAmount() {
    const amount = parseFloat(formData.projectAmount) || 0;
    const rate = parseFloat(formData.commissionRate) || 0;
    return (amount * rate / 100).toFixed(2);
  }

  useEffect(() => {
    const calculatedAmount = calculateCommissionAmount();
    if (calculatedAmount !== formData.commissionAmount) {
      setFormData(prev => ({ ...prev, commissionAmount: calculatedAmount }));
    }
  }, [formData.projectAmount, formData.commissionRate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('partner_projects')
      .update({
        project_reference: formData.projectReference || null,
        channel_partner_name: formData.channelPartnerName,
        channel_partner_reference: formData.channelPartnerReference || null,
        project_amount: parseFloat(formData.projectAmount) || 0,
        date: formData.date || null,
        paid_status: formData.paidStatus,
        commission_rate: parseFloat(formData.commissionRate) || 0,
        commission_amount: parseFloat(formData.commissionAmount) || 0,
        commission_paid_status: formData.commissionPaidStatus,
        company_name: formData.companyName || null,
        project_content: formData.projectContent || null,
        project_type: formData.projectType,
        project_status: formData.projectStatus,
      })
      .eq('id', project.id);

    if (error) {
      alert('Error updating partner project: ' + error.message);
    } else {
      onSuccess();
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this partner project?')) return;

    setLoading(true);
    const { error } = await supabase
      .from('partner_projects')
      .delete()
      .eq('id', project.id);

    if (error) {
      alert('Error deleting partner project: ' + error.message);
      setLoading(false);
    } else {
      onSuccess();
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Edit Partner Project</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Reference
              </label>
              <input
                type="text"
                value={formData.projectReference}
                onChange={(e) => setFormData({ ...formData, projectReference: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Channel Partner Name *
              </label>
              <input
                type="text"
                required
                value={formData.channelPartnerName}
                onChange={(e) => setFormData({ ...formData, channelPartnerName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Partner Reference
              </label>
              <input
                type="text"
                value={formData.channelPartnerReference}
                onChange={(e) => setFormData({ ...formData, channelPartnerReference: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Amount ($) *
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.projectAmount}
                onChange={(e) => setFormData({ ...formData, projectAmount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Paid Status
              </label>
              <div className="flex items-center gap-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.paidStatus}
                    onChange={(e) => setFormData({ ...formData, paidStatus: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Paid</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Type *
              </label>
              <select
                required
                value={formData.projectType}
                onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="audit">Audit</option>
                <option value="marketing">Marketing</option>
                <option value="production">Production</option>
                <option value="website">Website</option>
                <option value="others">Others</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Status
              </label>
              <select
                value={formData.projectStatus}
                onChange={(e) => setFormData({ ...formData, projectStatus: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Commission Rate (%) *
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.commissionRate}
                onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Commission Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.commissionAmount}
                onChange={(e) => setFormData({ ...formData, commissionAmount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                readOnly
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Commission Paid Status
              </label>
              <div className="flex items-center gap-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.commissionPaidStatus}
                    onChange={(e) => setFormData({ ...formData, commissionPaidStatus: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Commission Paid</span>
                </label>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project Content
            </label>
            <textarea
              value={formData.projectContent}
              onChange={(e) => setFormData({ ...formData, projectContent: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the project details..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Delete
            </button>
            <div className="flex-1"></div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
