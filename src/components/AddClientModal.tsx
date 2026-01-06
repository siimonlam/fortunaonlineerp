import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Building2, User, Mail, Phone, MapPin, Briefcase, Percent, Scan } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BusinessCardScanner } from './BusinessCardScanner';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
  client_number: string;
}

interface ChannelPartner {
  id: string;
  name: string;
  reference_number: string;
}

interface AddClientModalProps {
  clientType: 'company' | 'channel';
  onClose: () => void;
  onSuccess: () => void;
}

export function AddClientModal({ clientType, onClose, onSuccess }: AddClientModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [channelPartners, setChannelPartners] = useState<ChannelPartner[]>([]);
  const [nextClientNumber, setNextClientNumber] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    companyNameChinese: '',
    brandName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    salesSource: '',
    salesSourceDetail: '',
    industry: '',
    otherIndustry: '',
    isEcommerce: false,
    abbreviation: '',
    salesPersonId: '',
    commissionRate: '',
    parentClientId: '',
    parentCompanyName: '',
    channelPartnerId: '',
  });

  useEffect(() => {
    loadStaff();
    loadAllClients();
    loadChannelPartners();
    loadNextClientNumber();
  }, []);

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*');
    if (data) setStaff(data);
  }

  async function loadAllClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, client_number')
      .order('client_number');
    if (data) setAllClients(data as Client[]);
  }

  async function loadChannelPartners() {
    const { data } = await supabase
      .from('channel_partners')
      .select('id, name, reference_number')
      .order('reference_number');
    if (data) setChannelPartners(data);
  }

  async function loadNextClientNumber() {
    const { data, error } = await supabase.rpc('get_next_client_number');

    if (error) {
      console.error('Error getting next client number:', error);
      setNextClientNumber(null);
      return;
    }

    if (data) {
      const numericPart = typeof data === 'string'
        ? parseInt(data.replace(/\D/g, ''), 10)
        : data;
      setNextClientNumber(numericPart);
    } else {
      setNextClientNumber(null);
    }
  }

  const handleScanData = (scannedData: any) => {
    setFormData(prev => ({
      ...prev,
      ...(scannedData.company_name && { name: scannedData.company_name }),
      ...(scannedData.contact_name && { contactPerson: scannedData.contact_name }),
      ...(scannedData.email && { email: scannedData.email }),
      ...(scannedData.phone && { phone: scannedData.phone }),
      ...(scannedData.address && { address: scannedData.address }),
    }));
    setShowScanner(false);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData({
      ...formData,
      [name]: newValue
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (clientType === 'channel') {
        const { error } = await supabase.from('channel_partners').insert({
          name: formData.name,
          company_name_chinese: formData.companyNameChinese || null,
          contact_person: formData.contactPerson || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          notes: formData.notes || null,
          commission_rate: formData.commissionRate ? parseFloat(formData.commissionRate) : null,
          created_by: user?.id,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('create_client_onboarding', {
          p_company_name: formData.name,
          p_contact_name: formData.contactPerson || null,
          p_email: formData.email || null,
          p_phone: formData.phone || null,
          p_industry: formData.industry || null,
          p_company_name_chinese: formData.companyNameChinese || null,
          p_brand_name: formData.brandName || null,
          p_abbreviation: formData.abbreviation || null,
          p_address: formData.address || null,
          p_other_industry: formData.industry === 'Other' ? formData.otherIndustry || null : null,
          p_is_ecommerce: formData.isEcommerce,
          p_notes: formData.notes || null,
          p_sales_source: formData.salesSource || null,
          p_sales_source_detail: formData.salesSourceDetail || null,
          p_sales_person_id: formData.salesPersonId || null,
          p_parent_client_id: formData.parentClientId || null,
          p_parent_company_name: formData.parentCompanyName || null,
          p_channel_partner_id: formData.channelPartnerId || null,
        });

        if (error) throw error;
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error creating client:', error);
      alert(error.message || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 p-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Building2 className="w-7 h-7" />
                  {clientType === 'channel' ? 'Add Channel Partner' : 'Add Company Client'}
                </h2>
                {nextClientNumber !== null && (
                  <span className={`text-sm font-semibold px-3 py-1 rounded ${
                    clientType === 'channel' ? 'text-emerald-100 bg-emerald-600' : 'text-blue-100 bg-blue-800'
                  }`}>
                    {clientType === 'channel' ? '#CP' : '#'}{String(nextClientNumber).padStart(4, '0')}
                  </span>
                )}
              </div>
              {nextClientNumber !== null && (
                <p className="text-sm text-blue-100 mt-1">
                  New client will be assigned number {String(nextClientNumber).padStart(4, '0')}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {clientType === 'company' && (
            <div className="flex items-center justify-center pb-2">
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
              >
                <Scan className="w-5 h-5" />
                Scan Business Card
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Company Name (English) *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Company Name (Chinese)
              </label>
              <input
                type="text"
                name="companyNameChinese"
                value={formData.companyNameChinese}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {clientType === 'company' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    name="brandName"
                    value={formData.brandName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Abbreviation
                  </label>
                  <input
                    type="text"
                    name="abbreviation"
                    value={formData.abbreviation}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Contact Person
              </label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {clientType === 'company' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Briefcase className="w-4 h-4 inline mr-2" />
                    Industry
                  </label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Industry</option>
                    <option value="Technology">Technology</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Retail">Retail</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Finance">Finance</option>
                    <option value="Education">Education</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {formData.industry === 'Other' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Other Industry
                    </label>
                    <input
                      type="text"
                      name="otherIndustry"
                      value={formData.otherIndustry}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isEcommerce"
                    checked={formData.isEcommerce}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-slate-700">
                    E-commerce Business
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Sales Source
                  </label>
                  <select
                    name="salesSource"
                    value={formData.salesSource}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Source</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Referral">Referral</option>
                    <option value="Website">Website</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Event">Event</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {formData.salesSource && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Sales Source Detail
                    </label>
                    <input
                      type="text"
                      name="salesSourceDetail"
                      value={formData.salesSourceDetail}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Sales Person
                  </label>
                  <select
                    name="salesPersonId"
                    value={formData.salesPersonId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Sales Person</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Channel Partner
                  </label>
                  <select
                    name="channelPartnerId"
                    value={formData.channelPartnerId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None</option>
                    {channelPartners.map(cp => (
                      <option key={cp.id} value={cp.id}>
                        {cp.reference_number} - {cp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Parent Company
                  </label>
                  <select
                    name="parentClientId"
                    value={formData.parentClientId}
                    onChange={(e) => {
                      const selectedClient = allClients.find(c => c.client_number === e.target.value);
                      setFormData({
                        ...formData,
                        parentClientId: e.target.value,
                        parentCompanyName: selectedClient?.name || '',
                      });
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None (New Parent Account)</option>
                    {allClients.map(c => (
                      <option key={c.id} value={c.client_number}>
                        {c.client_number} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {clientType === 'channel' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Percent className="w-4 h-4 inline mr-2" />
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  name="commissionRate"
                  value={formData.commissionRate}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : `Create ${clientType === 'channel' ? 'Partner' : 'Client'}`}
            </button>
          </div>
        </form>
      </div>

      {showScanner && (
        <BusinessCardScanner
          onDataExtracted={handleScanData}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
