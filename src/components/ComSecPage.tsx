import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Search, X, Calendar, DollarSign, FileText, Book, Bell, CheckCircle, Receipt, Mail, LayoutGrid, List, Download, Upload } from 'lucide-react';
import { InvoicePreview } from './InvoicePreview';
import { DocumentFolderModal } from './DocumentFolderModal';
import { EditComSecClientModal } from './EditComSecClientModal';
import { LetterReceivedModal } from './LetterReceivedModal';
import { ComSecShareResourcesSection } from './ComSecShareResourcesSection';

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
  client_id: string | null;
  parent_client_id: string | null;
  status_id: string | null;
  created_at: string;
  created_by: string;
  case_officer?: { full_name: string };
  sales_person?: { full_name: string };
  status?: { name: string };
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

type TabType = 'hi-po' | 'clients' | 'pending_renewal' | 'invoices' | 'virtual_office' | 'knowledge_base' | 'reminders' | 'share_resources';

interface ComSecPageProps {
  activeModule: TabType;
  onClientClick?: (clientId: string) => void;
}

export function ComSecPage({ activeModule, onClientClick }: ComSecPageProps) {
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
  const [masterServices, setMasterServices] = useState<any[]>([]);

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
  const [invoiceSubTab, setInvoiceSubTab] = useState<'invoices' | 'service_settings'>('invoices');
  const [clientsSubTab, setClientsSubTab] = useState<'list' | 'autofill_settings'>('list');
  const [virtualOfficeSubTab, setVirtualOfficeSubTab] = useState<'virtual_office' | 'letters'>('virtual_office');
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [clientViewMode, setClientViewMode] = useState<'card' | 'table'>('card');
  const [selectedVOClient, setSelectedVOClient] = useState<{ id: string; code: string; name: string } | null>(null);
  const [letters, setLetters] = useState<any[]>([]);
  const [showAddMappingModal, setShowAddMappingModal] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<any[]>([]);
  const [newMapping, setNewMapping] = useState({
    field_label: '',
    pdf_field_name: '',
    client_field: '',
    field_type: 'text',
    display_order: 1,
    is_active: true
  });

  useEffect(() => {
    loadStaff();
    loadData();
    loadMasterServices();
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
      case 'hi-po':
      case 'clients':
      case 'pending_renewal':
        await loadComSecClients();
        break;
      case 'invoices':
        await loadInvoices();
        break;
      case 'virtual_office':
        await loadVirtualOffices();
        await loadLetters();
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
    console.log('Loading ComSec clients for module:', activeModule);

    const { data: comSecProjectType } = await supabase
      .from('project_types')
      .select('id')
      .eq('name', 'Com Sec')
      .maybeSingle();

    if (!comSecProjectType) {
      console.error('Com Sec project type not found');
      return;
    }

    const { data: statuses } = await supabase
      .from('statuses')
      .select('id, name')
      .eq('project_type_id', comSecProjectType.id);

    if (!statuses) {
      console.error('Statuses not found');
      return;
    }

    const hiPoStatus = statuses.find(s => s.name === 'Hi-Po');
    const activeStatus = statuses.find(s => s.name === 'Active');
    const pendingRenewalStatus = statuses.find(s => s.name === 'Pending Renewal');

    let query = supabase
      .from('comsec_clients')
      .select('*, case_officer:staff!case_officer_id(full_name), sales_person:staff!sales_person_id(full_name), status:statuses(name)');

    if (activeModule === 'hi-po' && hiPoStatus) {
      query = query.eq('status_id', hiPoStatus.id);
    } else if (activeModule === 'clients' && activeStatus) {
      query = query.eq('status_id', activeStatus.id);
    } else if (activeModule === 'pending_renewal' && pendingRenewalStatus) {
      query = query.eq('status_id', pendingRenewalStatus.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading ComSec clients:', error);
    } else {
      console.log('ComSec clients loaded:', data?.length);
      if (data) setComSecClients(data);
    }
  }

  async function loadInvoices() {
    const { data } = await supabase
      .from('comsec_invoices')
      .select('*, comsec_client:comsec_clients(company_name, company_code, id)')
      .order('issue_date', { ascending: false });

    if (data) {
      // Group invoices by invoice_number and sum amounts
      const groupedInvoices = Object.values(
        data.reduce((acc: any, invoice: any) => {
          const key = invoice.invoice_number;
          if (!acc[key]) {
            acc[key] = {
              ...invoice,
              items: [],
              total_amount: 0
            };
          }
          acc[key].items.push(invoice);
          acc[key].total_amount += invoice.amount || 0;
          // Keep the first item's details for display
          if (acc[key].items.length === 1) {
            acc[key].amount = invoice.amount;
          } else {
            acc[key].amount = acc[key].total_amount;
          }
          return acc;
        }, {})
      );
      setInvoices(groupedInvoices);
    }
  }

  async function loadVirtualOffices() {
    const { data } = await supabase
      .from('comsec_invoices')
      .select('*, comsec_client:comsec_clients(company_name, company_code), service:comsec_services(service_name)')
      .not('start_date', 'is', null)
      .not('end_date', 'is', null)
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

  async function loadMasterServices() {
    const { data } = await supabase
      .from('comsec_services')
      .select('*')
      .eq('is_active', true)
      .order('service_name');
    if (data) setMasterServices(data);
  }

  async function loadLetters() {
    const { data } = await supabase
      .from('virtual_office_letters')
      .select('*')
      .order('letter_received_date', { ascending: false });
    if (data) setLetters(data);
  }

  function downloadCSVTemplate() {
    const headers = [
      'company_code',
      'company_name',
      'company_name_chinese',
      'brn',
      'incorporation_date',
      'case_officer_email',
      'anniversary_month',
      'company_status',
      'nar1_status',
      'ar_due_date',
      'reminder_days',
      'contact_person',
      'email',
      'phone',
      'address',
      'sales_source',
      'sales_person_email',
      'remarks'
    ];

    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'comsec_clients_template.csv';
    link.click();
  }

  async function handleCSVImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const rowData: any = {};

          headers.forEach((header, index) => {
            const value = values[index];
            if (value && value !== '') {
              rowData[header] = value;
            }
          });

          if (!rowData.company_code) {
            errors.push(`Row ${i + 1}: Missing company_code`);
            errorCount++;
            continue;
          }

          const { data: existingClient } = await supabase
            .from('comsec_clients')
            .select('id')
            .eq('company_code', rowData.company_code)
            .maybeSingle();

          if (!existingClient) {
            errors.push(`Row ${i + 1}: Company code ${rowData.company_code} not found`);
            errorCount++;
            continue;
          }

          const updateData: any = {};

          if (rowData.company_name) updateData.company_name = rowData.company_name;
          if (rowData.company_name_chinese) updateData.company_name_chinese = rowData.company_name_chinese;
          if (rowData.brn) updateData.brn = rowData.brn;
          if (rowData.incorporation_date) updateData.incorporation_date = rowData.incorporation_date;
          if (rowData.anniversary_month) updateData.anniversary_month = rowData.anniversary_month;
          if (rowData.company_status) updateData.company_status = rowData.company_status;
          if (rowData.nar1_status) updateData.nar1_status = rowData.nar1_status;
          if (rowData.ar_due_date) updateData.ar_due_date = rowData.ar_due_date;
          if (rowData.reminder_days) updateData.reminder_days = parseInt(rowData.reminder_days);
          if (rowData.contact_person) updateData.contact_person = rowData.contact_person;
          if (rowData.email) updateData.email = rowData.email;
          if (rowData.phone) updateData.phone = rowData.phone;
          if (rowData.address) updateData.address = rowData.address;
          if (rowData.sales_source) updateData.sales_source = rowData.sales_source;
          if (rowData.remarks) updateData.remarks = rowData.remarks;

          if (rowData.case_officer_email) {
            const { data: officer } = await supabase
              .from('staff')
              .select('id')
              .eq('email', rowData.case_officer_email)
              .maybeSingle();
            if (officer) updateData.case_officer_id = officer.id;
          }

          if (rowData.sales_person_email) {
            const { data: salesperson } = await supabase
              .from('staff')
              .select('id')
              .eq('email', rowData.sales_person_email)
              .maybeSingle();
            if (salesperson) updateData.sales_person_id = salesperson.id;
          }

          const { error } = await supabase
            .from('comsec_clients')
            .update(updateData)
            .eq('id', existingClient.id);

          if (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        }

        alert(
          `CSV Import Complete!\n\n` +
          `Successfully updated: ${successCount} clients\n` +
          `Errors: ${errorCount}\n\n` +
          (errors.length > 0 ? `Error details:\n${errors.slice(0, 10).join('\n')}` : '')
        );

        await loadComSecClients();
      } catch (error) {
        console.error('CSV import error:', error);
        alert('Failed to import CSV file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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
    const filteredClients = comSecClients.filter(client => {
      // Filter based on search term only (status filtering is done at database level)
      const searchFilter = (client.company_name && client.company_name.toLowerCase().includes(searchTermClients.toLowerCase())) ||
        (client.company_code && client.company_code.toLowerCase().includes(searchTermClients.toLowerCase()));

      return searchFilter;
    });

    return (
      <div className="space-y-4">
        <div className="border-b border-slate-200">
          <div className="flex gap-4">
            <button
              onClick={() => setClientsSubTab('list')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                clientsSubTab === 'list'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <Search className="w-4 h-4 inline mr-2" />
              Clients
            </button>
            <button
              onClick={() => setClientsSubTab('autofill_settings')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                clientsSubTab === 'autofill_settings'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Auto-Fill Settings
            </button>
          </div>
        </div>

        {clientsSubTab === 'list' ? (
          <>
            <div className="flex items-center gap-4">
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
              <button
                onClick={downloadCSVTemplate}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                title="Download CSV Template"
              >
                <Download className="w-4 h-4" />
                Template
              </button>
              <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  className="hidden"
                />
              </label>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setClientViewMode('card')}
                  className={`p-2 rounded transition-colors ${
                    clientViewMode === 'card'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setClientViewMode('table')}
                  className={`p-2 rounded transition-colors ${
                    clientViewMode === 'table'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Table View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {clientViewMode === 'card' ? (
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
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Company Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Code</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">BRN</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Case Officer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Anniversary</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">AR Due Date</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map(client => (
                      <tr
                        key={client.id}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => { setEditingClient(client); setShowEditClientModal(true); }}
                      >
                        <td className="py-3 px-4 text-sm text-slate-900 font-medium">{client.company_name}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{client.company_code || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{client.brn || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            client.company_status === 'Active' ? 'bg-green-100 text-green-700' :
                            client.company_status === 'Dormant' ? 'bg-gray-100 text-gray-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {client.company_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">{client.case_officer?.full_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{client.anniversary_month || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {client.ar_due_date ? new Date(client.ar_due_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => { setSelectedClientForInvoice(client); setShowInvoiceModal(true); }}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Create Invoice"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setEditingClient(client); setShowEditClientModal(true); }}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('comsec_clients', client.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
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
            )}
          </>
        ) : (
          renderAutoFillSettings()
        )}
      </div>
    );
  }

  function renderAutoFillSettings() {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">NAR1 Auto-Fill Settings</h3>
          <p className="text-slate-600 mb-6">
            Configure how client data is automatically filled into NAR1 PDF fields. Each mapping defines which client field should populate a specific PDF form field.
          </p>

          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-semibold text-slate-700">Field Mappings</h4>
            <button
              onClick={() => setShowAddMappingModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Mapping
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Field Label</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">PDF Field Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Client Field</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Order</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-3 px-4 text-sm text-slate-900">Company Name</td>
                  <td className="py-3 px-4 text-sm font-mono text-slate-600">fill_2_P.1</td>
                  <td className="py-3 px-4 text-sm text-slate-600">company_name</td>
                  <td className="py-3 px-4 text-sm text-slate-600">Text</td>
                  <td className="py-3 px-4 text-sm text-slate-600">1</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                      Active
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {/* TODO: Edit mapping */}}
                        className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {/* TODO: Delete mapping */}}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h5 className="text-sm font-semibold text-blue-900 mb-2">Available Client Fields:</h5>
            <div className="grid grid-cols-3 gap-2 text-sm text-blue-800">
              <div><code className="bg-blue-100 px-2 py-1 rounded">company_name</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">company_code</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">brn</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">incorporation_date</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">company_status</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">nar1_status</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">anniversary_month</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">ar_due_date</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">address</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">contact_person</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">email</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">phone</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">remarks</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">sales_source</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">directors</code></div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">members</code></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderInvoicesTab() {
    const filteredInvoices = invoices.filter(inv =>
      (inv.invoice_number && inv.invoice_number.toLowerCase().includes(searchTermInvoices.toLowerCase())) ||
      (inv.comsec_client?.company_name && inv.comsec_client.company_name.toLowerCase().includes(searchTermInvoices.toLowerCase()))
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Company Code</th>
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
                      <td className="px-6 py-4">
                        <button
                          onClick={async () => {
                            try {
                              const fileName = `invoices/${invoice.comsec_client_id}/${invoice.invoice_number}.pdf`;
                              const { data, error } = await supabase.storage
                                .from('comsec-documents')
                                .createSignedUrl(fileName, 3600);

                              if (error || !data) {
                                alert('Invoice PDF not found');
                                return;
                              }

                              window.open(data.signedUrl, '_blank');
                            } catch (error) {
                              console.error('Error opening invoice:', error);
                              alert('Failed to open invoice');
                            }
                          }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors text-left"
                        >
                          {invoice.invoice_number}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {invoice.items?.length || 1} {invoice.items?.length === 1 ? 'item' : 'items'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            const client = comSecClients.find(c => c.id === invoice.comsec_client_id);
                            if (client) {
                              setEditingClient(client);
                              setShowEditClientModal(true);
                            }
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium"
                        >
                          {invoice.comsec_client?.company_code || '-'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            const client = comSecClients.find(c => c.id === invoice.comsec_client_id);
                            if (client) {
                              setEditingClient(client);
                              setShowEditClientModal(true);
                            }
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {invoice.comsec_client?.company_name}
                        </button>
                      </td>
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
                          {invoice.status !== 'Paid' && (
                            <button
                              onClick={() => { setEditingItem(invoice); setShowAddModal(true); }}
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              title="Edit invoice"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete('comsec_invoices', invoice.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete invoice"
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filteredVirtualOffices = virtualOffices.filter(vo =>
      (vo.comsec_client?.company_name && vo.comsec_client.company_name.toLowerCase().includes(searchTermVirtualOffice.toLowerCase())) ||
      (vo.comsec_client?.company_code && vo.comsec_client.company_code.toLowerCase().includes(searchTermVirtualOffice.toLowerCase()))
    );

    const filteredLetters = letters.filter(letter =>
      (letter.company_name && letter.company_name.toLowerCase().includes(searchTermVirtualOffice.toLowerCase())) ||
      (letter.company_code && letter.company_code.toLowerCase().includes(searchTermVirtualOffice.toLowerCase())) ||
      (letter.sender_name && letter.sender_name.toLowerCase().includes(searchTermVirtualOffice.toLowerCase()))
    );

    return (
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-slate-200 mb-4">
          <button
            onClick={() => setVirtualOfficeSubTab('virtual_office')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              virtualOfficeSubTab === 'virtual_office'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Virtual Office
          </button>
          <button
            onClick={() => setVirtualOfficeSubTab('letters')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              virtualOfficeSubTab === 'letters'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Letters Received
          </button>
        </div>

        {virtualOfficeSubTab === 'virtual_office' ? (
          <>
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by company name or code..."
                  value={searchTermVirtualOffice}
                  onChange={(e) => setSearchTermVirtualOffice(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Company Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Company Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Service</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">End Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredVirtualOffices.map(vo => {
                    const startDate = new Date(vo.start_date);
                    const endDate = new Date(vo.end_date);
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);
                    const isActive = today >= startDate && today <= endDate;

                    return (
                      <tr key={vo.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {vo.comsec_client?.company_code || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900">
                          {vo.comsec_client?.company_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {vo.service?.service_name || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {new Date(vo.start_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {new Date(vo.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setSelectedVOClient({
                                id: vo.comsec_client_id,
                                code: vo.comsec_client?.company_code || '',
                                name: vo.comsec_client?.company_name || ''
                              });
                              setShowLetterModal(true);
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                          >
                            <Mail className="w-4 h-4" />
                            Letter Received
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredVirtualOffices.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No virtual office services found
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search letters..."
                  value={searchTermVirtualOffice}
                  onChange={(e) => setSearchTermVirtualOffice(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Company Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Company Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Received Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Sender</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reference #</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Pickup</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLetters.map(letter => (
                    <tr key={letter.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {letter.company_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {letter.company_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(letter.letter_received_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {letter.sender_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {letter.letter_reference_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {letter.pickup_preference}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          letter.is_picked_up
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {letter.is_picked_up ? 'Picked Up' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLetters.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No letters found
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderKnowledgeBaseTab() {
    const filteredKB = knowledgeBase.filter(kb =>
      (kb.title && kb.title.toLowerCase().includes(searchTermKnowledgeBase.toLowerCase())) ||
      (kb.category && kb.category.toLowerCase().includes(searchTermKnowledgeBase.toLowerCase()))
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
      (r.comsec_client?.company_name && r.comsec_client.company_name.toLowerCase().includes(searchTermReminders.toLowerCase())) ||
      (r.reminder_type && r.reminder_type.toLowerCase().includes(searchTermReminders.toLowerCase())) ||
      (r.description && r.description.toLowerCase().includes(searchTermReminders.toLowerCase()))
    );
    const pendingReminders = filteredReminders.filter(r => !r.is_completed && new Date(r.due_date) >= now);
    const overdueReminders = filteredReminders.filter(r => !r.is_completed && new Date(r.due_date) < now);

    const arReminders = comSecClients
      .filter(client => {
        if (!client.ar_due_date || !client.reminder_days) return false;
        const matchesSearch = (client.company_name && client.company_name.toLowerCase().includes(searchTermReminders.toLowerCase())) ||
                             (client.company_code && client.company_code.toLowerCase().includes(searchTermReminders.toLowerCase()));
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
    const table = (activeModule === 'clients' || activeModule === 'hi-po') ? 'comsec_clients' :
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

      if ((activeModule === 'clients' || activeModule === 'hi-po') && data && data.company_code) {
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
      } else if ((activeModule === 'clients' || activeModule === 'hi-po') && data && !data.company_code) {
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
      {activeModule === 'hi-po' && renderClientsTab()}
      {activeModule === 'clients' && renderClientsTab()}
      {activeModule === 'invoices' && renderInvoicesTab()}
      {activeModule === 'virtual_office' && renderVirtualOfficeTab()}
      {activeModule === 'knowledge_base' && renderKnowledgeBaseTab()}
      {activeModule === 'reminders' && renderRemindersTab()}
      {activeModule === 'share_resources' && <ComSecShareResourcesSection />}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingItem ? 'Edit' : 'Add'} {(activeModule === 'clients' || activeModule === 'hi-po') ? 'Client' :
                  activeModule === 'invoices' ? 'Invoice' :
                  activeModule === 'virtual_office' ? 'Virtual Office' :
                  activeModule === 'knowledge_base' ? 'Knowledge Base Article' :
                  'Reminder'}
              </h2>
              <div className="flex items-center gap-2">
                {(activeModule === 'clients' || activeModule === 'hi-po') && editingItem && (
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
              {(activeModule === 'clients' || activeModule === 'hi-po') && (
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
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Invoice Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Number</label>
                        <input name="invoice_number" defaultValue={editingItem?.invoice_number || ''} placeholder="Invoice Number *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Client</label>
                        <select name="comsec_client_id" defaultValue={editingItem?.comsec_client_id || ''} required className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                          <option value="">Select Client *</option>
                          {comSecClients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Issue Date</label>
                        <input name="issue_date" type="date" defaultValue={editingItem?.issue_date || ''} placeholder="Issue Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                        <input name="due_date" type="date" defaultValue={editingItem?.due_date || ''} placeholder="Due Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                        <select name="status" defaultValue={editingItem?.status || 'Draft'} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                          <option value="Draft">Draft</option>
                          <option value="Sent">Sent</option>
                          <option value="Paid">Paid</option>
                          <option value="Overdue">Overdue</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
                        <input name="payment_date" type="date" defaultValue={editingItem?.payment_date || ''} placeholder="Payment Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                      <input name="payment_method" defaultValue={editingItem?.payment_method || ''} placeholder="Payment Method" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                  </div>

                  {editingItem?.items && editingItem.items.length > 1 ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">Invoice Items ({editingItem.items.length})</h3>
                      <div className="space-y-2">
                        {editingItem.items.map((item: any, index: number) => (
                          <div key={item.id} className="bg-white border border-slate-200 rounded p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">{item.description}</p>
                                {item.start_date && item.end_date && (
                                  <p className="text-xs text-slate-600 mt-1">
                                    {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <span className="text-sm font-semibold text-slate-900">${item.amount?.toFixed(2) || '0.00'}</span>
                            </div>
                          </div>
                        ))}
                        <div className="bg-slate-100 border border-slate-300 rounded p-3 flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-900">Total Amount</span>
                          <span className="text-base font-bold text-slate-900">${editingItem.total_amount?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mt-3">
                        Note: This invoice has multiple items. Editing will update all items with the same invoice number.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-2">Item Details</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                          <input name="amount" type="number" step="0.01" defaultValue={editingItem?.amount || ''} placeholder="Amount" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                          <textarea name="description" defaultValue={editingItem?.description || ''} placeholder="Description" className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={3}></textarea>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
                    <textarea name="remarks" defaultValue={editingItem?.remarks || ''} placeholder="Remarks" className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={2}></textarea>
                  </div>
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
        <InvoiceCreateModal
          client={selectedClientForInvoice}
          masterServices={masterServices}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedClientForInvoice(null);
          }}
          onPreview={(data) => {
            setInvoicePreviewData(data);
            setShowInvoiceModal(false);
            setShowInvoicePreview(true);
          }}
        />
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

              // Insert multiple invoice records - one for each service item
              const invoiceRecords = invoicePreviewData.items.map((item: any) => ({
                invoice_number: invoicePreviewData.invoiceNumber,
                comsec_client_id: invoicePreviewData.clientId,
                company_code: invoicePreviewData.companyCode || null,
                service_id: item.serviceId || null,
                issue_date: invoicePreviewData.issueDate,
                due_date: invoicePreviewData.dueDate,
                amount: item.amount,
                status: 'Draft',
                description: item.description,
                start_date: item.startDate || null,
                end_date: item.endDate || null,
                remarks: invoicePreviewData.notes,
                created_by: user?.id
              }));

              const { data: invoiceData, error: invoiceError } = await supabase
                .from('comsec_invoices')
                .insert(invoiceRecords)
                .select();

              if (invoiceError) throw invoiceError;

              // Get service details for each item and insert into virtual_office table
              const virtualOfficeRecords = await Promise.all(
                invoicePreviewData.items.map(async (item: any) => {
                  // Fetch service details from master services
                  const { data: serviceData } = await supabase
                    .from('comsec_services')
                    .select('service_name, service_description, service_type')
                    .eq('id', item.serviceId)
                    .maybeSingle();

                  return {
                    comsec_client_id: invoicePreviewData.clientId,
                    company_code: invoicePreviewData.companyCode || null,
                    company_name: invoicePreviewData.clientName,
                    service_name: serviceData?.service_name || item.description,
                    service_description: serviceData?.service_description || item.description,
                    service_type: serviceData?.service_type || 'other',
                    invoice_number: invoicePreviewData.invoiceNumber,
                    service_id: item.serviceId,
                    start_date: item.startDate || null,
                    end_date: item.endDate || null,
                    status: 'Active',
                    monthly_fee: item.amount,
                    created_by: user?.id
                  };
                })
              );

              const { error: voError } = await supabase
                .from('virtual_office')
                .insert(virtualOfficeRecords);

              if (voError) {
                console.error('Error saving to virtual_office:', voError);
                // Don't fail the whole operation if virtual_office insert fails
              }

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
          onClientClick={onClientClick}
        />
      )}

      {showLetterModal && selectedVOClient && (
        <LetterReceivedModal
          isOpen={showLetterModal}
          onClose={() => {
            setShowLetterModal(false);
            setSelectedVOClient(null);
          }}
          onSuccess={() => {
            loadLetters();
          }}
          clientId={selectedVOClient.id}
          companyCode={selectedVOClient.code}
          companyName={selectedVOClient.name}
        />
      )}

      {showAddMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900">Add Field Mapping</h2>
              <button
                onClick={() => {
                  setShowAddMappingModal(false);
                  setNewMapping({
                    field_label: '',
                    pdf_field_name: '',
                    client_field: '',
                    field_type: 'text',
                    display_order: 1,
                    is_active: true
                  });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              console.log('New mapping:', newMapping);
              setShowAddMappingModal(false);
              setNewMapping({
                field_label: '',
                pdf_field_name: '',
                client_field: '',
                field_type: 'text',
                display_order: 1,
                is_active: true
              });
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Field Label</label>
                <input
                  type="text"
                  value={newMapping.field_label}
                  onChange={(e) => setNewMapping({...newMapping, field_label: e.target.value})}
                  placeholder="e.g., Company Name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">A human-readable name for this mapping</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PDF Field Name</label>
                <input
                  type="text"
                  value={newMapping.pdf_field_name}
                  onChange={(e) => setNewMapping({...newMapping, pdf_field_name: e.target.value})}
                  placeholder="e.g., fill_2_P.1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">The exact field name in the NAR1 PDF form</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client Field</label>
                <select
                  value={newMapping.client_field}
                  onChange={(e) => setNewMapping({...newMapping, client_field: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a field...</option>
                  <option value="company_name">company_name</option>
                  <option value="company_code">company_code</option>
                  <option value="brn">brn</option>
                  <option value="incorporation_date">incorporation_date</option>
                  <option value="company_status">company_status</option>
                  <option value="nar1_status">nar1_status</option>
                  <option value="anniversary_month">anniversary_month</option>
                  <option value="ar_due_date">ar_due_date</option>
                  <option value="address">address</option>
                  <option value="contact_person">contact_person</option>
                  <option value="email">email</option>
                  <option value="phone">phone</option>
                  <option value="remarks">remarks</option>
                  <option value="sales_source">sales_source</option>
                  <option value="directors">directors</option>
                  <option value="members">members</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">The client database field to pull data from</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Field Type</label>
                  <select
                    value={newMapping.field_type}
                    onChange={(e) => setNewMapping({...newMapping, field_type: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="text">Text</option>
                    <option value="date">Date</option>
                    <option value="number">Number</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={newMapping.display_order}
                    onChange={(e) => setNewMapping({...newMapping, display_order: parseInt(e.target.value)})}
                    min="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={newMapping.is_active}
                  onChange={(e) => setNewMapping({...newMapping, is_active: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                  Active (enable this mapping)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Mapping
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMappingModal(false);
                    setNewMapping({
                      field_label: '',
                      pdf_field_name: '',
                      client_field: '',
                      field_type: 'text',
                      display_order: 1,
                      is_active: true
                    });
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceCreateModal({ client, masterServices, onClose, onPreview }: {
  client: ComSecClient;
  masterServices: any[];
  onClose: () => void;
  onPreview: (data: any) => void;
}) {
  const [selectedServices, setSelectedServices] = useState<Record<string, { checked: boolean; startDate: string; endDate: string }>>({});

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev => ({
      ...prev,
      [serviceId]: {
        checked: !prev[serviceId]?.checked,
        startDate: prev[serviceId]?.startDate || '',
        endDate: prev[serviceId]?.endDate || ''
      }
    }));
  };

  const handleDateChange = (serviceId: string, field: 'startDate' | 'endDate', value: string) => {
    setSelectedServices(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const invoiceNumber = formData.get('invoice_number') as string;
    const issueDate = formData.get('issue_date') as string;
    const dueDate = formData.get('due_date') as string;
    const notes = formData.get('notes') as string;

    const selectedItems: any[] = [];
    masterServices.forEach(service => {
      const serviceData = selectedServices[service.id];
      if (serviceData?.checked) {
        let description = service.service_name;

        const needsDates = service.service_type === 'company_secretary' || service.service_type === 'virtual_office';
        if (needsDates && serviceData.startDate && serviceData.endDate) {
          description += ` (${new Date(serviceData.startDate).toLocaleDateString()} - ${new Date(serviceData.endDate).toLocaleDateString()})`;
        }

        selectedItems.push({
          description,
          amount: parseFloat(service.price) || 0,
          serviceId: service.id,
          startDate: serviceData.startDate,
          endDate: serviceData.endDate
        });
      }
    });

    if (selectedItems.length === 0) {
      alert('Please select at least one service item');
      return;
    }

    onPreview({
      invoiceNumber,
      clientName: client.company_name,
      clientAddress: client.address || '',
      issueDate,
      dueDate,
      items: selectedItems,
      notes,
      clientId: client.id,
      companyCode: client.company_code
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">Create Invoice for {client.company_name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input name="invoice_number" placeholder="Invoice Number *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          <input name="issue_date" type="date" required placeholder="Issue Date *" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          <input name="due_date" type="date" required placeholder="Due Date *" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />

          <div className="border border-slate-300 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-slate-800 mb-2">Select Services</h3>
            {masterServices.map(service => {
              const needsDates = service.service_type === 'company_secretary' || service.service_type === 'virtual_office';
              const isChecked = selectedServices[service.id]?.checked || false;

              return (
                <div key={service.id} className="border border-slate-200 rounded-lg p-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleServiceToggle(service.id)}
                      className="w-4 h-4"
                    />
                    <span className="flex-1 font-medium">{service.service_name}</span>
                    <span className="font-semibold text-slate-800">HKD ${service.price.toFixed(2)}</span>
                  </label>

                  {needsDates && isChecked && (
                    <div className="mt-3 grid grid-cols-2 gap-3 pl-7">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={selectedServices[service.id]?.startDate || ''}
                          onChange={(e) => handleDateChange(service.id, 'startDate', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                        <input
                          type="date"
                          value={selectedServices[service.id]?.endDate || ''}
                          onChange={(e) => handleDateChange(service.id, 'endDate', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {masterServices.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-2">No services available. Add services in Invoice → Service Settings</p>
            )}
          </div>

          <textarea name="notes" placeholder="Notes (optional)" rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg"></textarea>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Preview Invoice
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
