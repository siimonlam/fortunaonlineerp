import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, Receipt, FileText, Bell, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Director {
  id?: string;
  name: string;
  id_number: string;
}

interface Member {
  id?: string;
  name: string;
  id_number: string;
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

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
}

interface EditComSecClientModalProps {
  client: ComSecClient;
  staff: Staff[];
  onClose: () => void;
  onSuccess: () => void;
  onCreateInvoice?: () => void;
  onOpenDocuments?: () => void;
}

export function EditComSecClientModal({ client, staff, onClose, onSuccess, onCreateInvoice, onOpenDocuments }: EditComSecClientModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [directors, setDirectors] = useState<Director[]>([{name: '', id_number: ''}]);
  const [members, setMembers] = useState<Member[]>([{name: '', id_number: ''}]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  const [formData, setFormData] = useState({
    company_name: client.company_name || '',
    company_code: client.company_code || '',
    brn: client.brn || '',
    incorporation_date: client.incorporation_date || '',
    case_officer_id: client.case_officer_id || '',
    anniversary_month: client.anniversary_month || '',
    company_status: client.company_status || 'Active',
    nar1_status: client.nar1_status || '',
    ar_due_date: client.ar_due_date || '',
    reminder_days: client.reminder_days?.toString() || '42',
    contact_person: client.contact_person || '',
    phone: client.phone || '',
    email: client.email || '',
    address: client.address || '',
    sales_source: client.sales_source || '',
    sales_person_id: client.sales_person_id || '',
    remarks: client.remarks || '',
  });

  useEffect(() => {
    loadDirectors();
    loadMembers();
    loadComments();
  }, [client.id]);

  async function loadDirectors() {
    const { data } = await supabase
      .from('comsec_directors')
      .select('*')
      .eq('comsec_client_id', client.id)
      .order('created_at');

    if (data && data.length > 0) {
      setDirectors(data.map(d => ({ id: d.id, name: d.name, id_number: d.id_number || '' })));
    }
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('comsec_members')
      .select('*')
      .eq('comsec_client_id', client.id)
      .order('created_at');

    if (data && data.length > 0) {
      setMembers(data.map(m => ({ id: m.id, name: m.name, id_number: m.id_number || '' })));
    }
  }

  async function loadComments() {
    const { data } = await supabase
      .from('comsec_client_comments')
      .select(`
        *,
        user:created_by (id, email)
      `)
      .eq('comsec_client_id', client.id)
      .order('created_at', { ascending: false });

    if (data) setComments(data);
  }

  async function handleAddComment() {
    if (!newComment.trim() || !user) return;

    const { error } = await supabase
      .from('comsec_client_comments')
      .insert({
        comsec_client_id: client.id,
        comment: newComment.trim(),
        created_by: user.id,
      });

    if (!error) {
      setNewComment('');
      loadComments();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error: clientError } = await supabase
        .from('comsec_clients')
        .update({
          company_name: formData.company_name.trim(),
          company_code: formData.company_code.trim() || null,
          brn: formData.brn.trim() || null,
          incorporation_date: formData.incorporation_date || null,
          case_officer_id: formData.case_officer_id || null,
          anniversary_month: formData.anniversary_month ? parseInt(formData.anniversary_month) : null,
          company_status: formData.company_status,
          nar1_status: formData.nar1_status.trim() || null,
          ar_due_date: formData.ar_due_date || null,
          reminder_days: formData.reminder_days ? parseInt(formData.reminder_days) : null,
          contact_person: formData.contact_person.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          address: formData.address.trim() || null,
          sales_source: formData.sales_source.trim() || null,
          sales_person_id: formData.sales_person_id || null,
          remarks: formData.remarks.trim() || null,
        })
        .eq('id', client.id);

      if (clientError) throw clientError;

      const existingDirectorIds = directors.filter(d => d.id).map(d => d.id!);
      await supabase
        .from('comsec_directors')
        .delete()
        .eq('comsec_client_id', client.id)
        .not('id', 'in', `(${existingDirectorIds.length > 0 ? existingDirectorIds.join(',') : "'none'"})`);

      for (const director of directors) {
        if (!director.name.trim()) continue;

        if (director.id) {
          await supabase
            .from('comsec_directors')
            .update({
              name: director.name.trim(),
              id_number: director.id_number.trim() || null,
            })
            .eq('id', director.id);
        } else {
          await supabase
            .from('comsec_directors')
            .insert({
              comsec_client_id: client.id,
              name: director.name.trim(),
              id_number: director.id_number.trim() || null,
            });
        }
      }

      const existingMemberIds = members.filter(m => m.id).map(m => m.id!);
      await supabase
        .from('comsec_members')
        .delete()
        .eq('comsec_client_id', client.id)
        .not('id', 'in', `(${existingMemberIds.length > 0 ? existingMemberIds.join(',') : "'none'"})`);

      for (const member of members) {
        if (!member.name.trim()) continue;

        if (member.id) {
          await supabase
            .from('comsec_members')
            .update({
              name: member.name.trim(),
              id_number: member.id_number.trim() || null,
            })
            .eq('id', member.id);
        } else {
          await supabase
            .from('comsec_members')
            .insert({
              comsec_client_id: client.id,
              name: member.name.trim(),
              id_number: member.id_number.trim() || null,
            });
        }
      }

      alert('Com Sec client updated successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating client:', error);
      alert(`Failed to update client: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex">
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
            <h2 className="text-xl font-semibold text-slate-900">Edit Com Sec Client</h2>
            <div className="flex items-center gap-2">
              {onCreateInvoice && (
                <button
                  type="button"
                  onClick={onCreateInvoice}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  Create Invoice
                </button>
              )}
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {client.company_code && onOpenDocuments && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900 uppercase">Quick Access</h3>
                  <button
                    type="button"
                    onClick={onOpenDocuments}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Open Document Folder
                  </button>
                </div>
                <p className="text-xs text-slate-600">Browse and manage documents for {client.company_code}</p>
              </div>
            )}

            {client.ar_due_date && client.reminder_days && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900 mb-1">Important Date Reminder</p>
                    <p className="text-sm text-amber-800">
                      <strong>AR Due Date:</strong> {new Date(client.ar_due_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-amber-800 mt-1">
                      <strong>Reminder Date:</strong> {new Date(new Date(client.ar_due_date).getTime() - (client.reminder_days * 24 * 60 * 60 * 1000)).toLocaleDateString()} ({client.reminder_days} days before)
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                  <input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Code</label>
                  <input
                    value={formData.company_code}
                    onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Contact Information</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                  <input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Sales Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source</label>
                  <input
                    value={formData.sales_source}
                    onChange={(e) => setFormData({ ...formData, sales_source: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sales Person</label>
                  <select
                    value={formData.sales_person_id}
                    onChange={(e) => setFormData({ ...formData, sales_person_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select sales person</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Company Secretary Details</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">BRN</label>
                  <input
                    value={formData.brn}
                    onChange={(e) => setFormData({ ...formData, brn: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Incorporation Date</label>
                  <input
                    type="date"
                    value={formData.incorporation_date}
                    onChange={(e) => setFormData({ ...formData, incorporation_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Case Officer</label>
                  <select
                    value={formData.case_officer_id}
                    onChange={(e) => setFormData({ ...formData, case_officer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select case officer</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Anniversary Month</label>
                  <select
                    value={formData.anniversary_month}
                    onChange={(e) => setFormData({ ...formData, anniversary_month: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select month</option>
                    {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>{new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Status</label>
                  <select
                    value={formData.company_status}
                    onChange={(e) => setFormData({ ...formData, company_status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Dormant">Dormant</option>
                    <option value="Liquidation">Liquidation</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NAR1 Status</label>
                  <input
                    value={formData.nar1_status}
                    onChange={(e) => setFormData({ ...formData, nar1_status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">AR Due Date</label>
                  <input
                    type="date"
                    value={formData.ar_due_date}
                    onChange={(e) => setFormData({ ...formData, ar_due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Reminder Days Before AR Due Date</label>
                <input
                  type="number"
                  value={formData.reminder_days}
                  onChange={(e) => setFormData({ ...formData, reminder_days: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="42"
                />
                <p className="text-xs text-slate-500 mt-1">Number of days before AR due date to send reminder (default: 42 days)</p>
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Directors</h3>
              <div className="space-y-2">
                {directors.map((director, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={director.name}
                      onChange={(e) => {
                        const updated = [...directors];
                        updated[index].name = e.target.value;
                        setDirectors(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Director name"
                    />
                    <input
                      type="text"
                      value={director.id_number}
                      onChange={(e) => {
                        const updated = [...directors];
                        updated[index].id_number = e.target.value;
                        setDirectors(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="ID / Passport number"
                    />
                    {directors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDirectors(directors.filter((_, i) => i !== index))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDirectors([...directors, {name: '', id_number: ''}])}
                className="mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Director
              </button>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Members</h3>
              <div className="space-y-2">
                {members.map((member, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => {
                        const updated = [...members];
                        updated[index].name = e.target.value;
                        setMembers(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Member name"
                    />
                    <input
                      type="text"
                      value={member.id_number}
                      onChange={(e) => {
                        const updated = [...members];
                        updated[index].id_number = e.target.value;
                        setMembers(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="ID / Passport number"
                    />
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setMembers(members.filter((_, i) => i !== index))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMembers([...members, {name: '', id_number: ''}])}
                className="mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Member
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <div className={`transition-all duration-300 border-l border-slate-200 bg-slate-50 ${isSidebarOpen ? 'w-96' : 'w-0'} overflow-hidden`}>
          {isSidebarOpen && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-white">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Notes & Comments
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-medium text-slate-600">{comment.user?.email || 'Unknown'}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-200 bg-white">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  className="mt-2 w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                >
                  Add Comment
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-slate-700 text-white p-2 rounded-l-lg hover:bg-slate-800 transition-colors"
          style={{ marginRight: isSidebarOpen ? '384px' : '0' }}
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
