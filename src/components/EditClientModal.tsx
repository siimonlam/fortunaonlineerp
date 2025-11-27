import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, UserPlus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
  company_name_chinese: string | null;
  client_number: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  sales_source: string | null;
  industry: string | null;
  other_industry: string | null;
  is_ecommerce: boolean | null;
  abbreviation: string | null;
  created_by: string;
  sales_person_id: string | null;
  channel_partner_id: string | null;
  commission_rate?: number | null;
  parent_client_id: string | null;
  parent_company_name: string | null;
  created_at: string;
  creator?: Staff;
  sales_person?: Staff;
  projects?: any[];
}

interface ChannelPartner {
  id: string;
  name: string;
  reference_number: string;
}

interface ClientPermission {
  id: string;
  user_id: string;
  can_view: boolean;
  can_edit: boolean;
  user?: Staff;
}

interface EditClientModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditClientModal({ client, onClose, onSuccess }: EditClientModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [channelPartners, setChannelPartners] = useState<ChannelPartner[]>([]);
  const [permissions, setPermissions] = useState<ClientPermission[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [permissionView, setPermissionView] = useState(true);
  const [permissionEdit, setPermissionEdit] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [partnerProjects, setPartnerProjects] = useState<any[]>([]);
  const [isChannelPartner, setIsChannelPartner] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    name: client.name,
    companyNameChinese: client.company_name_chinese || '',
    contactPerson: client.contact_person || '',
    email: client.email || '',
    phone: client.phone || '',
    address: client.address || '',
    notes: client.notes || '',
    salesSource: client.sales_source || '',
    salesSourceDetail: (client as any).sales_source_detail || '',
    industry: client.industry || '',
    otherIndustry: client.other_industry || '',
    isEcommerce: client.is_ecommerce || false,
    abbreviation: client.abbreviation || '',
    salesPersonId: client.sales_person_id || '',
    channelPartnerId: client.channel_partner_id || '',
    commissionRate: client.commission_rate?.toString() || '',
    parentClientId: client.parent_client_id || client.client_number?.toString() || '',
    parentCompanyName: client.parent_company_name || client.name || '',
  });
  const [originalData] = useState({
    name: client.name,
    companyNameChinese: client.company_name_chinese || '',
    contactPerson: client.contact_person || '',
    email: client.email || '',
    phone: client.phone || '',
    address: client.address || '',
    notes: client.notes || '',
    salesSource: client.sales_source || '',
    salesSourceDetail: (client as any).sales_source_detail || '',
    industry: client.industry || '',
    otherIndustry: client.other_industry || '',
    isEcommerce: client.is_ecommerce || false,
    abbreviation: client.abbreviation || '',
    salesPersonId: client.sales_person_id || '',
    channelPartnerId: client.channel_partner_id || '',
    commissionRate: client.commission_rate?.toString() || '',
    parentClientId: client.parent_client_id || client.client_number?.toString() || '',
    parentCompanyName: client.parent_company_name || client.name || '',
  });

  useEffect(() => {
    loadStaff();
    loadChannelPartners();
    loadAllClients();
    checkAdminStatus();
    loadPermissions();
    checkIfChannelPartner();
    loadPartnerProjects();
  }, []);

  useEffect(() => {
    const isChanged = JSON.stringify(formData) !== JSON.stringify(originalData);
    setHasUnsavedChanges(isChanged);
  }, [formData, originalData]);

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
    if (data) setAllClients(data as Client[]);
  }

  async function checkAdminStatus() {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user?.id)
      .maybeSingle();
    setIsAdmin(data?.role === 'admin');
  }

  async function loadPermissions() {
    const { data } = await supabase
      .from('client_permissions')
      .select('*')
      .eq('client_id', client.id);

    if (data) {
      setPermissions(data);
    }
  }

  async function checkIfChannelPartner() {
    const { data, error } = await supabase
      .from('channel_partners')
      .select('id')
      .eq('id', client.id)
      .maybeSingle();

    setIsChannelPartner(!!data);
  }

  async function loadPartnerProjects() {
    const { data } = await supabase
      .from('partner_projects')
      .select('*')
      .eq('channel_partner_id', client.id)
      .order('date', { ascending: false });

    if (data) {
      setPartnerProjects(data);
    }
  }

  async function grantPermission() {
    if (!selectedUser) return;

    setLoading(true);
    const { error } = await supabase
      .from('client_permissions')
      .upsert({
        client_id: client.id,
        user_id: selectedUser,
        can_view: permissionView,
        can_edit: permissionEdit,
        granted_by: user?.id
      });

    if (error) {
      alert('Error granting permission: ' + error.message);
    } else {
      setSelectedUser('');
      setPermissionView(true);
      setPermissionEdit(false);
      await loadPermissions();
    }
    setLoading(false);
  }

  async function revokePermission(permissionId: string) {
    setLoading(true);
    const { error } = await supabase
      .from('client_permissions')
      .delete()
      .eq('id', permissionId);

    if (error) {
      alert('Error revoking permission: ' + error.message);
    } else {
      await loadPermissions();
    }
    setLoading(false);
  }

  function handleClose() {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }

  function confirmClose() {
    setShowUnsavedWarning(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isChannelPartner) {
        const { error } = await supabase
          .from('channel_partners')
          .update({
            name: formData.name.trim(),
            company_name_chinese: formData.companyNameChinese.trim() || null,
            contact_person: formData.contactPerson.trim() || null,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
            sales_source: formData.salesSource.trim() || null,
            sales_source_detail: formData.salesSourceDetail.trim() || null,
            industry: formData.industry.trim() || null,
            abbreviation: formData.abbreviation.trim() || null,
            sales_person_id: formData.salesPersonId || null,
            commission_rate: formData.commissionRate ? parseFloat(formData.commissionRate) : null,
          })
          .eq('id', client.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clients')
          .update({
            name: formData.name.trim(),
            company_name_chinese: formData.companyNameChinese.trim() || null,
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
            parent_client_id: formData.parentClientId.trim() || null,
            parent_company_name: formData.parentCompanyName.trim() || null,
          })
          .eq('id', client.id);

        if (error) throw error;

        if (formData.channelPartnerId && formData.commissionRate) {
          const { error: partnerError } = await supabase
            .from('channel_partners')
            .update({
              commission_rate: parseFloat(formData.commissionRate),
            })
            .eq('id', formData.channelPartnerId);

          if (partnerError) {
            console.error('Error updating channel partner commission rate:', partnerError);
          }
        }
      }

      setHasUnsavedChanges(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating client:', error);
      alert(`Failed to update client: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;
      onSuccess();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      alert(`Failed to delete client: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Edit Client</h2>
              <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded">
                #{client.client_number}
              </span>
            </div>
            {client.creator && (
              <p className="text-sm text-slate-500 mt-1">
                Created by: {client.creator.full_name || client.creator.email}
              </p>
            )}
            {client.projects && client.projects.length > 0 && (
              <p className="text-sm text-slate-500">
                {client.projects.length} associated project{client.projects.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Abbreviation</label>
              <input
                type="text"
                value={formData.abbreviation}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter abbreviation"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Name in Chinese</label>
            <input
              type="text"
              value={formData.companyNameChinese}
              onChange={(e) => setFormData({ ...formData, companyNameChinese: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入中文公司名称"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Company Name</label>
              <select
                value={formData.parentCompanyName}
                onChange={(e) => {
                  const selectedClient = allClients.find(c => c.name === e.target.value);
                  if (selectedClient) {
                    setFormData({
                      ...formData,
                      parentCompanyName: selectedClient.name,
                      parentClientId: selectedClient.client_number || ''
                    });
                  } else {
                    setFormData({ ...formData, parentCompanyName: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select parent company</option>
                {allClients.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.client_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Client ID</label>
              <input
                type="text"
                value={formData.parentClientId}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                placeholder="Auto-filled from parent company"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact person name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sales Person</label>
              <select
                value={formData.salesPersonId}
                onChange={(e) => setFormData({ ...formData, salesPersonId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select sales person</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isChannelPartner && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Commission Rate (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.commissionRate}
                onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter commission rate (e.g., 15 for 15%)"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source</label>
              <select
                value={formData.salesSource}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, salesSource: value, salesSourceDetail: '' });

                  const selectedPartner = channelPartners.find(cp => cp.reference_number === value);
                  if (selectedPartner) {
                    setFormData(prev => ({ ...prev, salesSource: value, channelPartnerId: selectedPartner.id, salesSourceDetail: '' }));
                  } else {
                    setFormData(prev => ({ ...prev, salesSource: value, channelPartnerId: '', salesSourceDetail: '' }));
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Sales Source --</option>
                <option value="Direct">Direct</option>
                <option value="Referral">Referral</option>
                <option value="Website">Website</option>
                <option value="Seminar">Seminar</option>
                <option value="Exhibition">Exhibition</option>
                <option value="Marketing">Marketing</option>
                <option value="Social Media">Social Media</option>
                <option value="Others">Others</option>
                <optgroup label="Channel Partners">
                  {channelPartners.map(partner => (
                    <option key={partner.id} value={partner.reference_number}>
                      {partner.reference_number} - {partner.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value, otherIndustry: e.target.value !== 'Other' ? '' : formData.otherIndustry })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an industry</option>
                <option value="Accounting">Accounting</option>
                <option value="Advertising & Marketing">Advertising & Marketing</option>
                <option value="Agriculture">Agriculture</option>
                <option value="Automotive">Automotive</option>
                <option value="Aviation / Aerospace">Aviation / Aerospace</option>
                <option value="Banking & Financial Services">Banking & Financial Services</option>
                <option value="Biotechnology">Biotechnology</option>
                <option value="Construction">Construction</option>
                <option value="Consulting">Consulting</option>
                <option value="Consumer Goods / FMCG">Consumer Goods / FMCG</option>
                <option value="Education">Education</option>
                <option value="E-commerce">E-commerce</option>
                <option value="Energy / Oil & Gas">Energy / Oil & Gas</option>
                <option value="Engineering">Engineering</option>
                <option value="Entertainment & Media">Entertainment & Media</option>
                <option value="Fashion & Apparel">Fashion & Apparel</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Government / Public Sector">Government / Public Sector</option>
                <option value="Healthcare / Medical">Healthcare / Medical</option>
                <option value="Hospitality & Tourism">Hospitality & Tourism</option>
                <option value="Human Resources / Recruiting">Human Resources / Recruiting</option>
                <option value="Information Technology (IT)">Information Technology (IT)</option>
                <option value="Insurance">Insurance</option>
                <option value="Internet / Online Services">Internet / Online Services</option>
                <option value="Legal Services">Legal Services</option>
                <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Non-Profit / NGO">Non-Profit / NGO</option>
                <option value="Pharmaceuticals">Pharmaceuticals</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Retail">Retail</option>
                <option value="Software / SaaS">Software / SaaS</option>
                <option value="Telecommunications">Telecommunications</option>
                <option value="Transportation">Transportation</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {formData.industry === 'Other' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Specify Other Industry</label>
                <input
                  type="text"
                  value={formData.otherIndustry}
                  onChange={(e) => setFormData({ ...formData, otherIndustry: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter industry name"
                />
              </div>
            )}
            {(formData.salesSource === 'Seminar' || formData.salesSource === 'Exhibition') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {formData.salesSource === 'Seminar' ? 'Which Seminar?' : 'Which Exhibition?'}
                </label>
                <input
                  type="text"
                  value={formData.salesSourceDetail}
                  onChange={(e) => setFormData({ ...formData, salesSourceDetail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={formData.salesSource === 'Seminar' ? 'Enter seminar name' : 'Enter exhibition name'}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-commerce</label>
              <select
                value={formData.isEcommerce ? 'yes' : 'no'}
                onChange={(e) => setFormData({ ...formData, isEcommerce: e.target.value === 'yes' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
              placeholder="Enter additional notes"
            />
          </div>

          {isAdmin && (
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5 text-slate-600" />
                <h3 className="text-lg font-semibold text-slate-900">Access Permissions</h3>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">User</label>
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select a user...</option>
                      {staff.filter(s => s.id !== client.created_by && s.id !== client.sales_person_id).map(s => (
                        <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={grantPermission}
                      disabled={!selectedUser || loading}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      Grant Access
                    </button>
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={permissionView}
                      onChange={(e) => setPermissionView(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Can View</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={permissionEdit}
                      onChange={(e) => setPermissionEdit(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Can Edit</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 mb-2">Current Access:</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {client.creator?.full_name || client.creator?.email || 'Creator'}
                        </div>
                        <div className="text-xs text-slate-500">Creator (automatic access)</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">View</span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">Edit</span>
                    </div>
                  </div>
                  {client.sales_person && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {client.sales_person.full_name || client.sales_person.email}
                          </div>
                          <div className="text-xs text-slate-500">Sales Person (automatic access)</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">View</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">Edit</span>
                      </div>
                    </div>
                  )}
                  {permissions.map(perm => {
                    const permUser = staff.find(s => s.id === perm.user_id);
                    return (
                      <div key={perm.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {permUser?.full_name || permUser?.email || 'Unknown User'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {perm.can_view && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">View</span>
                          )}
                          {perm.can_edit && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">Edit</span>
                          )}
                          <button
                            type="button"
                            onClick={() => revokePermission(perm.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {permissions.length === 0 && (
                    <p className="text-sm text-slate-500 py-2">No additional permissions granted</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {isChannelPartner && partnerProjects.length > 0 && (
            <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <h4 className="font-semibold text-emerald-900 mb-3 flex items-center justify-between">
                Partner Projects
                <span className="text-sm font-normal text-emerald-700">
                  {partnerProjects.length} project{partnerProjects.length !== 1 ? 's' : ''}
                </span>
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {partnerProjects.map((project) => (
                  <div key={project.id} className="bg-white p-3 rounded border border-emerald-100">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-slate-500">Project Ref:</span>
                        <div className="font-medium text-slate-900">{project.project_reference || '-'}</div>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Partner Ref:</span>
                        <div className="font-medium text-emerald-700">{project.channel_partner_reference || '-'}</div>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Amount:</span>
                        <div className="font-medium text-slate-900">${project.project_amount?.toLocaleString() || '0'}</div>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Commission:</span>
                        <div className="font-medium text-slate-900">${project.commission_amount?.toLocaleString() || '0'} ({project.commission_rate}%)</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex-1"></div>
            <button
              type="button"
              onClick={handleClose}
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

      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Unsaved Changes</h3>
            <p className="text-slate-600 mb-6">
              You have unsaved changes. Are you sure you want to close without saving?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowUnsavedWarning(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Continue Editing
              </button>
              <button
                onClick={confirmClose}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
