import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

interface ChannelPartner {
  id: string;
  name: string;
  reference_number: string;
}

interface AddPartnerProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
  prefillData?: {
    project_reference?: string;
    company_name?: string;
    client_id?: string;
    channel_partner_id?: string;
    channel_partner_name?: string;
    channel_partner_reference?: string;
    project_content?: string;
  };
}

export function AddPartnerProjectModal({ onClose, onSuccess, prefillData }: AddPartnerProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [channelPartners, setChannelPartners] = useState<ChannelPartner[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState(prefillData?.company_name || '');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    projectReference: prefillData?.project_reference || '',
    companyName: prefillData?.company_name || '',
    clientId: prefillData?.client_id || '',
    channelPartnerId: prefillData?.channel_partner_id || '',
    channelPartnerName: prefillData?.channel_partner_name || '',
    channelPartnerReference: prefillData?.channel_partner_reference || '',
    projectAmount: '',
    date: prefillData ? new Date().toISOString().split('T')[0] : '',
    paidStatus: false,
    commissionRate: '',
    commissionPaidStatus: false,
    projectContent: prefillData?.project_content || '',
    projectType: 'others',
    projectStatus: 'pending',
  });

  useEffect(() => {
    loadClients();
    loadChannelPartners();
  }, []);

  useEffect(() => {
    if (clientSearchQuery.trim()) {
      const filtered = clients.filter(client =>
        client.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients([]);
    }
  }, [clientSearchQuery, clients]);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    if (data) setClients(data);
  }

  async function loadChannelPartners() {
    const { data } = await supabase
      .from('channel_partners')
      .select('id, name, reference_number')
      .order('reference_number');
    if (data) setChannelPartners(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('partner_projects').insert({
        project_reference: formData.projectReference.trim() || null,
        company_name: formData.companyName.trim(),
        client_id: formData.clientId || null,
        channel_partner_id: formData.channelPartnerId || null,
        channel_partner_name: formData.channelPartnerName.trim(),
        channel_partner_reference: formData.channelPartnerReference.trim() || null,
        project_amount: formData.projectAmount ? parseFloat(formData.projectAmount) : 0,
        date: formData.date || null,
        paid_status: formData.paidStatus,
        commission_rate: formData.commissionRate ? parseFloat(formData.commissionRate) : 0,
        commission_paid_status: formData.commissionPaidStatus,
        project_content: formData.projectContent.trim() || null,
        project_type: formData.projectType,
        project_status: formData.projectStatus,
      });

      if (error) throw error;
      onSuccess();
    } catch (error: any) {
      alert('Error creating partner project: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChannelPartnerChange(partnerId: string) {
    const partner = channelPartners.find(p => p.id === partnerId);
    if (partner) {
      setFormData({
        ...formData,
        channelPartnerId: partnerId,
        channelPartnerName: partner.name,
        channelPartnerReference: partner.reference_number,
      });
    }
  }

  function handleClientSelect(client: Client) {
    setFormData({
      ...formData,
      clientId: client.id,
      companyName: client.name,
    });
    setClientSearchQuery(client.name);
    setShowClientSuggestions(false);
  }

  function handleClientSearchChange(value: string) {
    setClientSearchQuery(value);
    setFormData({
      ...formData,
      companyName: value,
      clientId: '',
    });
    setShowClientSuggestions(true);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Create Partner Project</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
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
                placeholder="e.g., FP00001"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client
              </label>
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(e) => handleClientSearchChange(e.target.value)}
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type to search clients..."
              />
              {showClientSuggestions && filteredClients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleClientSelect(client)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors text-sm"
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter company name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Channel Partner <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.channelPartnerId}
              onChange={(e) => handleChannelPartnerChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Channel Partner --</option>
              {channelPartners.map(partner => (
                <option key={partner.id} value={partner.id}>
                  {partner.reference_number} - {partner.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.projectAmount}
                onChange={(e) => setFormData({ ...formData, projectAmount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Type <span className="text-red-500">*</span>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Commission Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.commissionRate}
                onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.paidStatus}
                  onChange={(e) => setFormData({ ...formData, paidStatus: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Project Paid</span>
              </label>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.commissionPaidStatus}
                onChange={(e) => setFormData({ ...formData, commissionPaidStatus: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Commission Paid</span>
            </label>
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

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Partner Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
