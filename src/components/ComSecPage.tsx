import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Search, X, Calendar, DollarSign, FileText, Book, Bell, CheckCircle } from 'lucide-react';

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
  remarks: string | null;
  created_at: string;
  created_by: string;
  case_officer?: { full_name: string };
}

interface Invoice {
  id: string;
  comsec_client_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  status: string;
  description: string | null;
  paid_date: string | null;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);

  const [comSecClients, setComSecClients] = useState<ComSecClient[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [virtualOffices, setVirtualOffices] = useState<VirtualOffice[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase[]>([]);
  const [reminders, setReminders] = useState<DueDateReminder[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

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
      .select('*, case_officer:staff!case_officer_id(full_name)')
      .order('created_at', { ascending: false });
    if (data) setComSecClients(data);
  }

  async function loadInvoices() {
    const { data } = await supabase
      .from('comsec_invoices')
      .select('*, comsec_client:comsec_clients(company_name)')
      .order('invoice_date', { ascending: false });
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

  function renderClientsTab() {
    const filteredClients = comSecClients.filter(client =>
      client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.company_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => { setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Client
          </button>
        </div>

        <div className="grid gap-4">
          {filteredClients.map(client => (
            <div key={client.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
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
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingItem(client); setShowAddModal(true); }}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('comsec_clients', client.id)}
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

  function renderInvoicesTab() {
    const filteredInvoices = invoices.filter(inv =>
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.comsec_client?.company_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(invoice.invoice_date).toLocaleDateString()}</td>
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
      </div>
    );
  }

  function renderVirtualOfficeTab() {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Virtual Office Services</h3>
          <button
            onClick={() => { setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Service
          </button>
        </div>

        <div className="grid gap-4">
          {virtualOffices.map(vo => (
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
      kb.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kb.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
    const pendingReminders = reminders.filter(r => !r.is_completed && new Date(r.due_date) >= now);
    const overdueReminders = reminders.filter(r => !r.is_completed && new Date(r.due_date) < now);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Due Date Reminders</h3>
          <button
            onClick={() => { setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Reminder
          </button>
        </div>

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
      const { error } = await supabase
        .from(table)
        .insert([{ ...formData, created_by: user?.id }]);

      if (error) {
        alert(`Error: ${error.message}`);
        return;
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
              <button
                onClick={() => { setShowAddModal(false); setEditingItem(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
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
                  <input name="company_code" defaultValue={editingItem?.company_code || ''} placeholder="Company Code" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="company_name" defaultValue={editingItem?.company_name || ''} placeholder="Company Name *" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="brn" defaultValue={editingItem?.brn || ''} placeholder="BRN" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="incorporation_date" type="date" defaultValue={editingItem?.incorporation_date || ''} placeholder="Incorporation Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <select name="case_officer_id" defaultValue={editingItem?.case_officer_id || ''} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">Select Case Officer</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <input name="anniversary_month" type="number" min="1" max="12" defaultValue={editingItem?.anniversary_month || ''} placeholder="Anniversary Month (1-12)" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="company_status" defaultValue={editingItem?.company_status || 'Active'} placeholder="Company Status" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="nar1_status" defaultValue={editingItem?.nar1_status || ''} placeholder="NAR1 Status" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <input name="ar_due_date" type="date" defaultValue={editingItem?.ar_due_date || ''} placeholder="AR Due Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  <textarea name="remarks" defaultValue={editingItem?.remarks || ''} placeholder="Remarks" className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={3}></textarea>
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
    </div>
  );
}
