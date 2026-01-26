import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { INDUSTRY_OPTIONS } from '../constants/industries';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface ChannelPartner {
  id: string;
  name: string;
  reference_number: string;
}

interface Inquiry {
  id: string;
  company_name: string;
  name: string;
  phone: string;
  email: string;
  industry: string | null;
  interest: string;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  from_website: string | null;
}

interface ConvertInquiryToClientModalProps {
  inquiry: Inquiry;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConvertInquiryToClientModal({ inquiry, onClose, onSuccess }: ConvertInquiryToClientModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [channelPartners, setChannelPartners] = useState<ChannelPartner[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: inquiry.company_name,
    companyNameChinese: '',
    brandName: '',
    contactPerson: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    address: '',
    notes: inquiry.notes || `Interest: ${inquiry.interest}`,
    salesSource: inquiry.from_website || 'Inquiry',
    salesSourceDetail: '',
    industry: inquiry.industry || '',
    otherIndustry: '',
    isEcommerce: false,
    abbreviation: '',
    salesPersonId: inquiry.assigned_to || '',
    channelPartnerId: '',
    commissionRate: '',
    parentClientId: '',
    parentCompanyName: '',
  });

  useEffect(() => {
    loadStaff();
    loadChannelPartners();
    loadAllClients();
  }, []);

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*');
    if (data) setStaff(data);
  }

  async function loadChannelPartners() {
    const { data } = await supabase
      .from('channel_partners')
      .select('id, name, reference_number')
      .order('reference_number');
    if (data) setChannelPartners(data);
  }

  async function loadAllClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, client_number')
      .order('client_number');
    if (data) setAllClients(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert([
          {
            name: formData.name.trim(),
            company_name_chinese: formData.companyNameChinese.trim() || null,
            brand_name: formData.brandName.trim() || null,
            contact_person: formData.contactPerson.trim() || null,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
            sales_source: formData.salesSource.trim() || null,
            sales_source_detail: formData.salesSourceDetail.trim() || null,
            industry: formData.industry.trim() || null,
            other_industry: formData.industry === 'Other' ? formData.otherIndustry.trim() || null : null,
            is_ecommerce: formData.isEcommerce,
            abbreviation: formData.abbreviation.trim() || null,
            sales_person_id: formData.salesPersonId || null,
            channel_partner_id: formData.channelPartnerId || null,
            commission_rate: formData.commissionRate ? parseFloat(formData.commissionRate) : null,
            parent_client_id: formData.parentClientId.trim() || null,
            parent_company_name: formData.parentCompanyName.trim() || null,
            created_by: user?.id,
          }
        ])
        .select()
        .single();

      if (clientError) throw clientError;

      const { error: inquiryError } = await supabase
        .from('inquiries')
        .update({ status: 'converted' })
        .eq('id', inquiry.id);

      if (inquiryError) throw inquiryError;

      alert('Inquiry successfully converted to client!');
      onSuccess();
    } catch (error: any) {
      console.error('Error converting inquiry:', error);
      alert(error.message || 'Failed to convert inquiry to client');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Convert Inquiry to Client</h2>
              <p className="text-sm text-slate-500">Review and complete the client information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Company Name (Chinese)
              </label>
              <input
                type="text"
                value={formData.companyNameChinese}
                onChange={(e) => setFormData({ ...formData, companyNameChinese: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Brand Name
              </label>
              <input
                type="text"
                value={formData.brandName}
                onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Abbreviation
              </label>
              <input
                type="text"
                value={formData.abbreviation}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Industry
              </label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {INDUSTRY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.industry === 'Other' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Other Industry
                </label>
                <input
                  type="text"
                  value={formData.otherIndustry}
                  onChange={(e) => setFormData({ ...formData, otherIndustry: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Specify industry"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sales Source
              </label>
              <select
                value={formData.salesSource}
                onChange={(e) => setFormData({ ...formData, salesSource: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Source</option>
                <option value="Website">Website</option>
                <option value="Referral">Referral</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Event">Event</option>
                <option value="Social Media">Social Media</option>
                <option value="Inquiry">Inquiry</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sales Source Detail
              </label>
              <input
                type="text"
                value={formData.salesSourceDetail}
                onChange={(e) => setFormData({ ...formData, salesSourceDetail: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional details"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sales Person
              </label>
              <select
                value={formData.salesPersonId}
                onChange={(e) => setFormData({ ...formData, salesPersonId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Sales Person</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Channel Partner
              </label>
              <select
                value={formData.channelPartnerId}
                onChange={(e) => setFormData({ ...formData, channelPartnerId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Channel Partner</option>
                {channelPartners.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.reference_number} - {cp.name}
                  </option>
                ))}
              </select>
            </div>

            {formData.channelPartnerId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.commissionRate}
                  onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Parent Client
              </label>
              <select
                value={formData.parentClientId}
                onChange={(e) => {
                  const selectedClient = allClients.find(c => c.client_number === e.target.value);
                  setFormData({
                    ...formData,
                    parentClientId: e.target.value,
                    parentCompanyName: selectedClient ? selectedClient.name : ''
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Parent Client</option>
                {allClients.map((client) => (
                  <option key={client.id} value={client.client_number}>
                    {client.client_number} - {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isEcommerce}
                  onChange={(e) => setFormData({ ...formData, isEcommerce: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">E-commerce</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Converting...' : 'Convert to Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
