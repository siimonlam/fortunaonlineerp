import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Search, X, Calendar, DollarSign, FileText, Book, Bell, CheckCircle, Receipt } from 'lucide-react';
import { InvoicePreview } from './InvoicePreview';
import { DocumentFolderModal } from './DocumentFolderModal';
import { EditComSecClientModal } from './EditComSecClientModal';

interface ComSecClient {
  id: string;
  company_code: string | null;
  company_name: string;
  brn: string | null;
  incorporation_date: string | null;
  case_officer_id: string | null;
  anniversary_month: string | null;
  company_status: string;
  nar1_status: string | null;
  directors: any;
  members: any;
  ar_due_date: string | null;
  reminder_days: number | null;
  remarks: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  sales_source: string | null;
  sales_person_id: string | null;
  created_at: string;
  created_by: string;
  case_officer?: { full_name: string };
  sales_person?: { full_name: string };
}

interface Invoice {
  id: string;
  comsec_client_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: string;
  description: string | null;
  payment_date: string | null;
  payment_method: string | null;
  remarks: string | null;
  created_at: string;
  comsec_client?: { company_name: string };
}

interface VirtualOffice {
  id: string;
  comsec_client_id: string;
  service_type: string;
  address: string | null;
  start_date: string;
  end_date: string | null;
  renewal_date: string | null;
  monthly_fee: number | null;
  remarks: string | null;
  created_at: string;
  comsec_client?: { company_name: string };
}

interface KnowledgeBase {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[] | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface DueDateReminder {
  id: string;
  comsec_client_id: string;
  reminder_type: string;
  due_date: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  assigned_to_id: string | null;
  created_at: string;
  comsec_client?: { company_name: string };
  assigned_to?: { full_name: string };
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

type TabType = 'clients' | 'invoices' | 'virtual_office' | 'knowledge_base' | 'reminders';

interface ComSecPageProps {
  activeModule: TabType;
}

export function ComSecPage({ activeModule }: ComSecPageProps) {
  const { user } = useAuth();
  const [searchTermClients, setSearchTermClients] = useState('');
  const [searchTermInvoices, setSearchTermInvoices] = useState('');
  const [searchTermVirtualOffice, setSearchTermVirtualOffice] = useState('');
  const [searchTermKnowledgeBase, setSearchTermKnowledgeBase] = useState('');
  const [searchTermReminders, setSearchTermReminders] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);

  const [comSecClients, setComSecClients] = useState<ComSecClient[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [virtualOffices, setVirtualOffices] = useState<VirtualOffice[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase[]>([]);
  const [reminders, setReminders] = useState<DueDateReminder[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ComSecClient | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedClientForInvoice, setSelectedClientForInvoice] = useState<ComSecClient | null>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentModalCompanyCode, setDocumentModalCompanyCode] = useState('');

  useEffect(() => {
    loadStaff();
    loadData();
  }, [activeModule]);

  async function loadStaff() {
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, email')
      .order('full_name');
    if (data) setStaff(data);
  }

  async function loadData() {
    switch (activeModule) {
      case 'clients':
        await loadComSecClients();
        break;
      case 'invoices':
        await loadInvoices();
        break;
      case 'virtual_office':
        await loadVirtualOffices();
        break;
      case 'knowledge_base':
        await loadKnowledgeBase();
        break;
      case 'reminders':
        await loadReminders();
        break;
    }
  }

  async function loadComSecClients() {
    const { data } = await supabase
      .from('comsec_clients')
      .select('*, case_officer:staff!case_officer_id(full_name), sales_person:staff!sales_person_id(full_name)')
      .order('created_at', { ascending: false });
    if (data) setComSecClients(data);
  }

  async function loadInvoices() {
    const { data } = await supabase
      .from('comsec_invoices')
      .select('*, comsec_client:comsec_clients(company_name)')
      .order('issue_date', { ascending: false });
    if (data) setInvoices(data);
  }

  async function loadVirtualOffices() {
    const { data } = await supabase
      .from('virtual_office')
      .select('*, comsec_client:comsec_clients(company_name)')
      .order('start_date', { ascending: false });
    if (data) setVirtualOffices(data);
  }

  async function loadKnowledgeBase() {
    const { data } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setKnowledgeBase(data);
  }

  async function loadReminders() {
    const { data } = await supabase
      .from('due_date_reminders')
      .select('*, comsec_client:comsec_clients(company_name), assigned_to:staff!assigned_to_id(full_name)')
      .order('due_date', { ascending: true });
    if (data) setReminders(data);
  }

  function ServiceSettingsTab() {
    const [services, setServices] = useState<any[]>([]);
    const [editingService, setEditingService] = useState<any>(null);
    const [showServiceForm, setShowServiceForm] = useState(false);

    useEffect(() => {
      loadServices();
    }, []);

    async function loadServices() {
      const { data } = await supabase
        .from('comsec_services')
        .select('*')
        .order('service_name');
      if (data) setServices(data);
    }

    async function handleSaveService(serviceData: any) {
      try {
        if (serviceData.id) {
          const { error } = await supabase
            .from('comsec_services')
            .update({
              service_name: serviceData.service_name,
              description: serviceData.description || null,
              price: parseFloat(serviceData.price) || 0,
            })
            .eq('id', serviceData.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('comsec_services')
            .insert({
              service_name: serviceData.service_name,
              service_type: serviceData.service_name.toLowerCase().replace(/\s+/g, '_'),
              description: serviceData.description || null,
              price: parseFloat(serviceData.price) || 0,
              is_active: true,
            });

          if (error) throw error;
        }

        setShowServiceForm(false);
        setEditingService(null);
        loadServices();
      } catch (error: any) {
        alert(`Error saving service: ${error.message}`);
      }
    }

    async function handleDeleteService(serviceId: string) {
      if (!confirm('Are you sure you want to delete this service?')) return;

      const { error } = await supabase
        .from('comsec_services')
        .delete()
        .eq('id', serviceId);

      if (!error) loadServices();
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Manage Services</h3>
          <button
            onClick={() => {
              setEditingService({ service_name: '', description: '', price: 0 });
              setShowServiceForm(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Service
          </button>
        </div>

        {showServiceForm && editingService && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <h4 className="font-semibold text-slate-900 mb-4">
              {editingService.id ? 'Edit Service' : 'Add New Service'}
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  value={editingService.service_name}
                  onChange={(e) => setEditingService({ ...editingService, service_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={editingService.description || ''}
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price (HKD) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingService.price}
                  onChange={(e) => setEditingService({ ...editingService, price: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSaveService(editingService)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingService.id ? 'Update' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowServiceForm(false);
                    setEditingService(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Service Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Price (HKD)</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {services.map(service => (
                <tr key={service.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{service.service_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{service.description || '-'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">${service.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingService(service);
                          setShowServiceForm(true);
                        }}
                        className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderClientsTab() {
    const filteredClients = comSecClients.filter(client =>
      client.company_name.toLowerCase().includes(searchTermClients.toLowerCase()) ||
      client.company_code?.toLowerCase().includes(searchTermClients.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchTermClients}
            onChange={(e) => setSearchTermClients(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid gap-4">
          {filteredClients.map(client => {
            return (
              <div
                key={client.id}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => { setEditingClient(client); setShowEditClientModal(true); }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{client.company_name}</h3>
                      {client.company_code && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                          {client.company_code}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        client.company_status === 'Active' ? 'bg-green-100 text-green-700' :
                        client.company_status === 'Dormant' ? 'bg-gray-100 text-gray-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {client.company_status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {client.brn && <div><span className="text-slate-500">BRN:</span> <span className="text-slate-900">{client.brn}</span></div>}
                      {client.incorporation_date && <div><span className="text-slate-500">Incorporated:</span> <span className="text-slate-900">{new Date(client.incorporation_date).toLocaleDateString()}</span></div>}
                      {client.case_officer && <div><span className="text-slate-500">Case Officer:</span> <span className="text-slate-900">{client.case_officer.full_name}</span></div>}
                      {client.anniversary_month && <div><span className="text-slate-500">Anniversary:</span> <span className="text-slate-900">{client.anniversary_month}</span></div>}
                      {client.nar1_status && <div><span className="text-slate-500">NAR1 Status:</span> <span className="text-slate-900">{client.nar1_status}</span></div>}
                      {client.ar_due_date && <div><span className="text-slate-500">AR Due:</span> <span className="text-slate-900">{new Date(client.ar_due_date).toLocaleDateString()}</span></div>}
                    </div>
                    {client.remarks && <p className="mt-3 text-sm text-slate-600">{client.remarks}</p>}
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setSelectedClientForInvoice(client); setShowInvoiceModal(true); }}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Create Invoice"
                    >
                      <Receipt className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setEditingClient(client); setShowEditClientModal(true); }}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('comsec_clients', client.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderInvoicesTab() {
    const [invoiceSubTab, setInvoiceSubTab] = useState<'invoices' | 'service_settings'>('invoices');
    const filteredInvoices = invoices.filter(inv =>
      inv.invoice_number.toLowerCase().includes(searchTermInvoices.toLowerCase()) ||
      inv.comsec_client?.company_name.toLowerCase().includes(searchTermInvoices.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="border-b border-slate-200">
          <div className="flex gap-4">
            <button
              onClick={() => setInvoiceSubTab('invoices')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                invoiceSubTab === 'invoices'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4 inline mr-2" />
              Invoices
            </button>
            <button
              onClick={() => setInvoiceSubTab('service_settings')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                invoiceSubTab === 'service_settings'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Service Settings
            </button>
          </div>
        </div>

        {invoiceSubTab === 'invoices' ? (
          <>
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTermInvoices}
                  onChange={(e) => setSearchTermInvoices(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => { setEditingItem(null); setShowAddModal(true); }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Invoice
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Invoice #</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInvoices.map(invoice => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{invoice.invoice_number}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{invoice.comsec_client?.company_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{new Date(invoice.due_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">${invoice.amount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          invoice.status === 'Paid' ? 'bg-green-100 text-green-700' :
                          invoice.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingItem(invoice); setShowAddModal(true); }}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('comsec_invoices', invoice.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <ServiceSettingsTab />
        )}
      </div>
    );
  }

  function renderVirtualOfficeTab() {
    const filteredVirtualOffices = virtualOffices.filter(vo =>
      vo.comsec_client?.company_name.toLowerCase().includes(searchTermVirtualOffice.toLowerCase()) ||
      vo.service_type.toLowerCase().includes(searchTermVirtualOffice.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search virtual offices..."
              value={searchTermVirtualOffice}
              onChange={(e) => setSearchTermVirtualOffice(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => { setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Service
          </button>
        </div>

        <div className="grid gap-4">
          {filteredVirtualOffices.map(vo => (
            <div key={vo.id} className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 mb-2">{vo.comsec_client?.company_name}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500">Service:</span> <span className="text-slate-900">{vo.service_type}</span></div>
                    {vo.monthly_fee && <div><span className="text-slate-500">Monthly Fee:</span> <span className="text-slate-900">${vo.monthly_fee}</span></div>}
                    <div><span className="text-slate-500">Start Date:</span> <span className="text-slate-900">{new Date(vo.start_date).toLocaleDateString()}</span></div>
                    {vo.end_date && <div><span className="text-slate-500">End Date:</span> <span className="text-slate-900">{new Date(vo.end_date).toLocaleDateString()}</span></div>}
                    {vo.renewal_date && <div><span className="text-slate-500">Renewal:</span> <span className="text-slate-900">{new Date(vo.renewal_date).toLocaleDateString()}</span></div>}
                  </div>
                  {vo.address && <p className="mt-2 text-sm text-slate-600">{vo.address}</p>}
                  {vo.remarks && <p className="mt-2 text-sm text-slate-600 italic">{vo.remarks}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingItem(vo); setShowAddModal(true); }}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('virtual_office', vo.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderKnowledgeBaseTab() {
    const filteredKB = knowledgeBase.filter(kb =>
      kb.title.toLowerCase().includes(searchTermKnowledgeBase.toLowerCase()) ||
      kb.category.toLowerCase().includes(searchTermKnowledgeBase.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTermKnowledgeBase}
              onChange={(e) => setSearchTermKnowledgeBase(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => { setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Article
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {filteredKB.map(kb => (
            <div key={kb.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900">{kb.title}</h4>
                  {kb.is_public && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Public</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingItem(kb); setShowAddModal(true); }}
                    className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('knowledge_base', kb.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-2">Category: {kb.category}</p>
              <p className="text-sm text-slate-600 line-clamp-3">{kb.content}</p>
              {kb.tags && kb.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {kb.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderRemindersTab() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const filteredReminders = reminders.filter(r =>
      r.comsec_client?.company_name.toLowerCase().includes(searchTermReminders.toLowerCase()) ||
      r.reminder_type.toLowerCase().includes(searchTermReminders.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchTermReminders.toLowerCase())
    );
    const pendingReminders = filteredReminders.filter(r => !r.is_completed && new Date(r.due_date) >= now);
    const overdueReminders = filteredReminders.filter(r => !r.is_completed && new Date(r.due_date) < now);

    const arReminders = comSecClients
      .filter(client => {
        if (!client.ar_due_date || !client.reminder_days) return false;
        const matchesSearch = client.company_name.toLowerCase().includes(searchTermReminders.toLowerCase()) ||
                             client.company_code?.toLowerCase().includes(searchTermReminders.toLowerCase());
        return matchesSearch;
      })
      .map(client => {
        const dueDate = new Date(client.ar_due_date!);
        const reminderDate = new Date(dueDate.getTime() - (client.reminder_days! * 24 * 60 * 60 * 1000));
        const daysUntilReminder = Math.ceil((reminderDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        return {
          client,
          dueDate,
          reminderDate,
          daysUntilReminder,
          daysUntilDue,
          isPastReminder: daysUntilReminder <= 0,
          isOverdue: daysUntilDue < 0
        };
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const arOverdue = arReminders.filter(r => r.isOverdue);
    const arPastReminder = arReminders.filter(r => !r.isOverdue && r.isPastReminder);
    const arUpcoming = arReminders.filter(r => !r.isOverdue && !r.isPastReminder);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search reminders..."
              value={searchTermReminders}
              onChange={(e) => setSearchTermReminders(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => { setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Reminder
          </button>
        </div>

        {arOverdue.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-red-600 uppercase mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Overdue AR Submissions
            </h4>
            <div className="space-y-2">
              {arOverdue.map(({ client, dueDate, daysUntilDue }) => (
                <div
                  key={client.id}
                  className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setEditingClient(client); setShowEditClientModal(true); }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">AR OVERDUE</span>
                        <span className="font-semibold text-slate-900">{client.company_name}</span>
                        {client.company_code && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            {client.company_code}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-1">Annual Return submission is overdue</p>
                      <div className="flex items-center gap-4 text-sm text-red-700 font-semibold">
                        <span>Due Date: {dueDate.toLocaleDateString()}</span>
                        <span>{Math.abs(daysUntilDue)} days overdue</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {arPastReminder.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-orange-600 uppercase mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              AR Due Soon (Past Reminder Date)
            </h4>
            <div className="space-y-2">
              {arPastReminder.map(({ client, dueDate, reminderDate, daysUntilDue }) => (
                <div
                  key={client.id}
                  className="bg-orange-50 border border-orange-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setEditingClient(client); setShowEditClientModal(true); }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-orange-600 text-white text-xs font-bold rounded">AR DUE SOON</span>
                        <span className="font-semibold text-slate-900">{client.company_name}</span>
                        {client.company_code && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            {client.company_code}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-1">Annual Return submission deadline approaching</p>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>Due: <strong>{dueDate.toLocaleDateString()}</strong></span>
                        <span>Reminder: {reminderDate.toLocaleDateString()}</span>
                        <span className="text-orange-700 font-semibold">{daysUntilDue} days left</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {arUpcoming.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-blue-600 uppercase mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming AR Submissions
            </h4>
            <div className="space-y-2">
              {arUpcoming.map(({ client, dueDate, reminderDate, daysUntilReminder, daysUntilDue }) => (
                <div
                  key={client.id}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setEditingClient(client); setShowEditClientModal(true); }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">AR UPCOMING</span>
                        <span className="font-semibold text-slate-900">{client.company_name}</span>
                        {client.company_code && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            {client.company_code}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-1">Annual Return submission scheduled</p>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>Due: <strong>{dueDate.toLocaleDateString()}</strong></span>
                        <span>Reminder: {reminderDate.toLocaleDateString()}</span>
                        <span className="text-blue-700 font-semibold">Reminder in {daysUntilReminder} days</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(arReminders.length > 0 && (overdueReminders.length > 0 || pendingReminders.length > 0)) && (
          <div className="border-t-2 border-slate-200 pt-4">
            <h3 className="text-base font-semibold text-slate-700 uppercase mb-3">Other Reminders</h3>
          </div>
        )}

        {overdueReminders.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-red-600 uppercase mb-3">Overdue</h4>
            <div className="space-y-2">
              {overdueReminders.map(reminder => (
                <div key={reminder.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">{reminder.reminder_type}</span>
                        <span className="font-semibold text-slate-900">{reminder.comsec_client?.company_name}</span>
                      </div>
                      <p className="text-sm text-slate-600 mb-1">{reminder.description}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>Due: {new Date(reminder.due_date).toLocaleDateString()}</span>
                        {reminder.assigned_to && <span>Assigned: {reminder.assigned_to.full_name}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCompleteReminder(reminder.id)}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                        title="Mark as complete"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditingItem(reminder); setShowAddModal(true); }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete('due_date_reminders', reminder.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingReminders.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-600 uppercase mb-3">Upcoming</h4>
            <div className="space-y-2">
              {pendingReminders.map(reminder => {
                const daysLeft = Math.ceil((new Date(reminder.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={reminder.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">{reminder.reminder_type}</span>
                          <span className="font-semibold text-slate-900">{reminder.comsec_client?.company_name}</span>
                          <span className="text-xs text-slate-500">({daysLeft} days left)</span>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">{reminder.description}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span>Due: {new Date(reminder.due_date).toLocaleDateString()}</span>
                          {reminder.assigned_to && <span>Assigned: {reminder.assigned_to.full_name}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCompleteReminder(reminder.id)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                          title="Mark as complete"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingItem(reminder); setShowAddModal(true); }}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete('due_date_reminders', reminder.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  async function handleCompleteReminder(id: string) {
    const { error } = await supabase
      .from('due_date_reminders')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      loadReminders();
    }
  }

  async function handleDelete(table: string, id: string) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      loadData();
    }
  }

  async function handleSave(formData: any) {
    const table = activeModule === 'clients' ? 'comsec_clients' :
                  activeModule === 'invoices' ? 'comsec_invoices' :
                  activeModule === 'virtual_office' ? 'comsec_virtual_office' :
                  activeModule === 'knowledge_base' ? 'comsec_knowledge_base' :
                  'due_date_reminders';

    if (editingItem) {
      const { error } = await supabase
        .from(table)
        .update(formData)
        .eq('id', editingItem.id);

      if (error) {
        alert(`Error: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from(table)
        .insert([{ ...formData, created_by: user?.id }])
        .select()
        .single();

      if (error) {
        alert(`Error: ${error.message}`);
        return;
      }

      if (activeModule === 'clients' && data && data.company_code) {
        console.log('Attempting to create folders for company code:', data.company_code);
        try {
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-comsec-folders`;
          console.log('Calling edge function:', apiUrl);

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              company_code: data.company_code,
              client_id: data.id
            })
          });

          console.log('Response status:', response.status);
          const result = await response.json();
          console.log('Folder creation result:', result);

          if (!response.ok) {
            console.error('Folder creation failed:', result);
            alert(`⚠️ Client created but folder creation failed!\n\nError: ${result.error || 'Unknown error'}\n\nCheck console for details.`);
          } else {
            console.log('✅ Folders created successfully!');
            alert(`✅ Client created successfully!\n\n${result.folders_created || 9} folders created for ${data.company_code}`);
          }
        } catch (folderError: any) {
          console.error('Error creating folders:', folderError);
          alert(`⚠️ Warning: Client created but folder creation encountered an error.\n\nError: ${folderError.message}\n\nCheck console for details.`);
        }
      } else if (activeModule === 'clients' && data && !data.company_code) {
        console.warn('⚠️ Company code is required to create folders. Skipping folder creation.');
        alert('⚠️ Note: Company code is required to create document folders.\n\nPlease edit the client and add a company code to create folders.');
      }
    }

    setShowAddModal(false);
    setEditingItem(null);
    loadData();
  }

  return (
    <div className="p-6">
      {activeModule === 'clients' && renderClientsTab()}
      {activeModule === 'invoices' && renderInvoicesTab()}
      {activeModule === 'virtual_office' && renderVirtualOfficeTab()}
      {activeModule === 'knowledge_base' && renderKnowledgeBaseTab()}
      {activeModule === 'reminders' && renderRemindersTab()}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingItem ? 'Edit' : 'Add'} {activeModule === 'clients' ? 'Client' :
                  activeModule === 'invoices' ? 'Invoice' :
                  activeModule === 'virtual_office' ? 'Virtual Office' :
                  activeModule === 'knowledge_base' ? 'Knowledge Base Article' :
                  'Reminder'}
              </h2>
              <div className="flex items-center gap-2">
                {activeModule === 'clients' && editingItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientForInvoice(editingItem);
                      setShowInvoiceModal(true);
                      setShowAddModal(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    Create Invoice
                  </button>
                )}
                <button
                  onClick={() => { setShowAddModal(false); setEditingItem(null); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data: any = {};
              formData.forEach((value, key) => {
                if (key === 'directors' || key === 'members' || key === 'tags') {
                  try {
                    data[key] = value ? JSON.parse(value as string) : null;
                  } catch {
                    data[key] = null;
                  }
                } else if (key === 'is_public' || key === 'is_completed') {
                  data[key] = value === 'true';
                } else {
                  data[key] = value || null;
                }
              });
              handleSave(data);
            }} className="p-6 space-y-4">
              {activeModule === 'clients' && (
                <>
                  {editingItem && editingItem.company_code && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-900 uppercase">Quick Access</h3>
                        <button
                          onClick={() => {
                            setDocumentModalCompanyCode(editingItem.company_code!);
                            setShowDocumentModal(true);
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Open Document Folder
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">Browse and manage documents for {editingItem.company_code}</p>
                    </div>
                  )}

                  {editingItem && editingItem.ar_due_date && editingItem.reminder_days && (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <Bell className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-900 mb-1">Important Date Reminder</p>
                          <p className="text-sm text-amber-800">
                            <strong>AR Due Date:</strong> {new Date(editingItem.ar_due_date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-amber-800 mt-1">
                            <strong>Reminder Date:</strong> {new Date(new Date(editingItem.ar_due_date).getTime() - (editingItem.reminder_days * 24 * 60 * 60 * 1000)).toLocaleDateString()} ({editingItem.reminder_days} days before)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border-b border-slate-200 pb-4 mb-4">
                    <h3 className="text-base font-semibold text-slate-900 mb-3">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                        <input name="company_name" defaultValue={editingItem?.company_name || ''} required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Company Code</label>
                        <input name="company_code" defaultValue={editingItem?.company_code || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-slate-200 pb-4 mb-4">
                    <h3 className="text-base font-semibold text-slate-900 mb-3">Contact Information</h3>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                        <input name="contact_person" defaultValue={editingItem?.contact_person || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                        <input name="phone" defaultValue={editingItem?.phone || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input name="email" type="email" defaultValue={editingItem?.email || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                      <input name="address" defaultValue={editingItem?.address || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                  </div>

                  <div className="border-b border-slate-200 pb-4 mb-4">
                    <h3 className="text-base font-semibold text-slate-900 mb-3">Sales Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source</label>
                        <input name="sales_source" defaultValue={editingItem?.sales_source || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Sales Person</label>
                        <select name="sales_person_id" defaultValue={editingItem?.sales_person_id || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                          <option value="">Select sales person</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-slate-200 pb-4 mb-4">
                    <h3 className="text-base font-semibold text-slate-900 mb-3">Company Secretary Details</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">BRN</label>
                        <input name="brn" defaultValue={editingItem?.brn || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Incorporation Date</label>
                        <input name="incorporation_date" type="date" defaultValue={editingItem?.incorporation_date || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Case Officer</label>
                        <select name="case_officer_id" defaultValue={editingItem?.case_officer_id || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                          <option value="">Select Case Officer</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Anniversary Month</label>
                        <select name="anniversary_month" defaultValue={editingItem?.anniversary_month || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                          <option value="">Select month</option>
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => (
                            <option key={month} value={month}>{new Date(2000, month-1).toLocaleString('default', { month: 'long' })}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Company Status</label>
                        <select name="company_status" defaultValue={editingItem?.company_status || 'Active'} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                          <option value="Active">Active</option>
                          <option value="Dormant">Dormant</option>
                          <option value="Pending Renewal">Pending Renewal</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">NAR1 Status</label>
                        <input name="nar1_status" defaultValue={editingItem?.nar1_status || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">AR Due Date</label>
                      <input name="ar_due_date" type="date" defaultValue={editingItem?.ar_due_date || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                  </div>

                  <div className="border-b border-slate-200 pb-4 mb-4">
                    <h3 className="text-base font-semibold text-slate-900 mb-3">Reminder Settings</h3>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Reminder Days Before AR Due Date</label>
                      <input
                        name="reminder_days"
                        type="number"
                        min="1"
                        defaultValue={editingItem?.reminder_days || 42}
                        placeholder="e.g., 42"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                      <p className="text-xs text-slate-500 mt-1">Number of days before AR due date to send reminder (default: 42 days)</p>
                    </div>
                  </div>

                  <div className="border-b border-slate-200 pb-4 mb-4">
                    <h3 className="text-base font-semibold text-slate-900 mb-3">Directors & Members</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Directors (JSON array)</label>
                        <textarea
                          name="directors"
                          defaultValue={editingItem?.directors ? JSON.stringify(editingItem.directors) : ''}
                          placeholder='[{"name": "John Doe", "id": "123"}]'
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg min-h-[80px]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Members (JSON array)</label>
                        <textarea
                          name="members"
                          defaultValue={editingItem?.members ? JSON.stringify(editingItem.members) : ''}
                          placeholder='[{"name": "Jane Smith", "shares": 100}]'
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg min-h-[80px]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                    <textarea name="remarks" defaultValue={editingItem?.remarks || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={3} />
                  </div>
                </>
              )}

              {activeModule === 'invoices' && (
                <>
                  <input name="invoice_number" defaultValue={editingItem?.invoice_number || ''} placeholder="Invoice Number *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <select name="comsec_client_id" defaultValue={editingItem?.comsec_client_id || ''} required className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">Select Client *</option>
                    {comSecClients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                  <input name="issue_date" type="date" defaultValue={editingItem?.issue_date || ''} placeholder="Issue Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="due_date" type="date" defaultValue={editingItem?.due_date || ''} placeholder="Due Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="amount" type="number" step="0.01" defaultValue={editingItem?.amount || ''} placeholder="Amount" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <select name="status" defaultValue={editingItem?.status || 'Draft'} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                  <textarea name="description" defaultValue={editingItem?.description || ''} placeholder="Description" className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={3}></textarea>
                  <input name="payment_date" type="date" defaultValue={editingItem?.payment_date || ''} placeholder="Payment Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="payment_method" defaultValue={editingItem?.payment_method || ''} placeholder="Payment Method" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <textarea name="remarks" defaultValue={editingItem?.remarks || ''} placeholder="Remarks" className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={2}></textarea>
                </>
              )}

              {activeModule === 'virtual_office' && (
                <>
                  <select name="comsec_client_id" defaultValue={editingItem?.comsec_client_id || ''} required className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">Select Client *</option>
                    {comSecClients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                  <input name="service_type" defaultValue={editingItem?.service_type || ''} placeholder="Service Type *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <textarea name="address" defaultValue={editingItem?.address || ''} placeholder="Address" className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={2}></textarea>
                  <input name="start_date" type="date" defaultValue={editingItem?.start_date || ''} placeholder="Start Date *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="end_date" type="date" defaultValue={editingItem?.end_date || ''} placeholder="End Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="renewal_date" type="date" defaultValue={editingItem?.renewal_date || ''} placeholder="Renewal Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="monthly_fee" type="number" step="0.01" defaultValue={editingItem?.monthly_fee || ''} placeholder="Monthly Fee" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <textarea name="remarks" defaultValue={editingItem?.remarks || ''} placeholder="Remarks" className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={2}></textarea>
                </>
              )}

              {activeModule === 'knowledge_base' && (
                <>
                  <input name="title" defaultValue={editingItem?.title || ''} placeholder="Title *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <textarea name="content" defaultValue={editingItem?.content || ''} placeholder="Content *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={8}></textarea>
                  <input name="category" defaultValue={editingItem?.category || ''} placeholder="Category *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="tags" defaultValue={editingItem?.tags ? JSON.stringify(editingItem.tags) : ''} placeholder='Tags (JSON array, e.g., ["tag1", "tag2"])' className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <label className="flex items-center gap-2">
                    <input name="is_public" type="checkbox" defaultChecked={editingItem?.is_public ?? true} value="true" className="rounded" />
                    <span>Public</span>
                  </label>
                </>
              )}

              {activeModule === 'reminders' && (
                <>
                  <select name="comsec_client_id" defaultValue={editingItem?.comsec_client_id || ''} required className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">Select Client *</option>
                    {comSecClients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                  <select name="reminder_type" defaultValue={editingItem?.reminder_type || 'Annual Return'} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="Annual Return">Annual Return</option>
                    <option value="AGM">AGM</option>
                    <option value="Renewal">Renewal</option>
                    <option value="Filing">Filing</option>
                    <option value="Other">Other</option>
                  </select>
                  <input name="due_date" type="date" defaultValue={editingItem?.due_date || ''} placeholder="Due Date *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <textarea name="description" defaultValue={editingItem?.description || ''} placeholder="Description" className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={3}></textarea>
                  <select name="assigned_to_id" defaultValue={editingItem?.assigned_to_id || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">Assign To</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  {editingItem ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => { setShowAddModal(false); setEditingItem(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvoiceModal && selectedClientForInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">Create Invoice for {selectedClientForInvoice.company_name}</h2>
              <button onClick={() => { setShowInvoiceModal(false); setSelectedClientForInvoice(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const invoiceNumber = formData.get('invoice_number') as string;
              const issueDate = formData.get('issue_date') as string;
              const dueDate = formData.get('due_date') as string;
              const notes = formData.get('notes') as string;

              const selectedItems = [];
              if (formData.get('item_company_secretary') === 'on') {
                selectedItems.push({ description: '1 Year Company Secretary Service', amount: 5000 });
              }
              if (formData.get('item_virtual_office') === 'on') {
                selectedItems.push({ description: '1 Year Company Virtual Office Service', amount: 5000 });
              }

              if (selectedItems.length === 0) {
                alert('Please select at least one service item');
                return;
              }

              setInvoicePreviewData({
                invoiceNumber,
                clientName: selectedClientForInvoice.company_name,
                clientAddress: selectedClientForInvoice.address || '',
                issueDate,
                dueDate,
                items: selectedItems,
                notes,
                clientId: selectedClientForInvoice.id
              });
              setShowInvoiceModal(false);
              setShowInvoicePreview(true);
            }} className="p-6 space-y-4">
              <input name="invoice_number" placeholder="Invoice Number *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <input name="issue_date" type="date" required placeholder="Issue Date *" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <input name="due_date" type="date" required placeholder="Due Date *" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />

              <div className="border border-slate-300 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-slate-800 mb-2">Select Services</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="item_company_secretary" className="w-4 h-4" />
                  <span className="flex-1">1 Year Company Secretary Service</span>
                  <span className="font-semibold text-slate-800">HKD $5,000.00</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="item_virtual_office" className="w-4 h-4" />
                  <span className="flex-1">1 Year Company Virtual Office Service</span>
                  <span className="font-semibold text-slate-800">HKD $5,000.00</span>
                </label>
              </div>

              <textarea name="notes" placeholder="Notes (optional)" rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg"></textarea>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Preview Invoice
                </button>
                <button type="button" onClick={() => { setShowInvoiceModal(false); setSelectedClientForInvoice(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvoicePreview && invoicePreviewData && (
        <InvoicePreview
          invoiceNumber={invoicePreviewData.invoiceNumber}
          clientName={invoicePreviewData.clientName}
          clientAddress={invoicePreviewData.clientAddress}
          issueDate={invoicePreviewData.issueDate}
          dueDate={invoicePreviewData.dueDate}
          items={invoicePreviewData.items}
          notes={invoicePreviewData.notes}
          onClose={() => {
            setShowInvoicePreview(false);
            setInvoicePreviewData(null);
            setSelectedClientForInvoice(null);
          }}
          onSave={async (invoiceId, pdfBlob) => {
            try {
              const totalAmount = invoicePreviewData.items.reduce((sum: number, item: any) => sum + item.amount, 0);

              const { data: invoiceData, error: invoiceError } = await supabase
                .from('comsec_invoices')
                .insert([{
                  invoice_number: invoicePreviewData.invoiceNumber,
                  comsec_client_id: invoicePreviewData.clientId,
                  issue_date: invoicePreviewData.issueDate,
                  due_date: invoicePreviewData.dueDate,
                  amount: totalAmount,
                  status: 'Draft',
                  description: invoicePreviewData.items.map((item: any) => item.description).join(', '),
                  remarks: invoicePreviewData.notes,
                  created_by: user?.id
                }])
                .select()
                .single();

              if (invoiceError) throw invoiceError;

              const fileName = `invoices/${invoicePreviewData.clientId}/${invoicePreviewData.invoiceNumber}.pdf`;
              const { error: storageError } = await supabase.storage
                .from('comsec-documents')
                .upload(fileName, pdfBlob, {
                  contentType: 'application/pdf',
                  upsert: true
                });

              if (storageError) throw storageError;

              alert('Invoice saved successfully!');
              loadInvoices();
              setShowInvoicePreview(false);
              setInvoicePreviewData(null);
              setSelectedClientForInvoice(null);
            } catch (error: any) {
              console.error('Error saving invoice:', error);
              alert(`Error saving invoice: ${error.message}`);
            }
          }}
        />
      )}

      {showDocumentModal && documentModalCompanyCode && (
        <DocumentFolderModal
          companyCode={documentModalCompanyCode}
          onClose={() => {
            setShowDocumentModal(false);
            setDocumentModalCompanyCode('');
          }}
        />
      )}

      {showEditClientModal && editingClient && (
        <EditComSecClientModal
          client={editingClient}
          staff={staff}
          onClose={() => {
            setShowEditClientModal(false);
            setEditingClient(null);
          }}
          onSuccess={() => {
            setShowEditClientModal(false);
            setEditingClient(null);
            loadData();
          }}
          onCreateInvoice={() => {
            setSelectedClientForInvoice(editingClient);
            setShowInvoiceModal(true);
            setShowEditClientModal(false);
          }}
          onOpenDocuments={() => {
            if (editingClient.company_code) {
              setDocumentModalCompanyCode(editingClient.company_code);
              setShowDocumentModal(true);
            }
          }}
        />
      )}
    </div>
  );
}
