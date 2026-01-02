import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Clock, CheckCircle, XCircle, ExternalLink, Calendar, Send, Search, ArrowUpDown, Eye, Edit, X } from 'lucide-react';

interface ScheduledEmailsPageProps {
  onProjectClick?: (projectId: string) => void;
}

export function ScheduledEmailsPage({ onProjectClick }: ScheduledEmailsPageProps) {
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'scheduled_date' | 'sent_at'>('scheduled_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    subject: '',
    body: '',
    recipient_emails: [] as string[],
    scheduled_date: ''
  });

  useEffect(() => {
    loadScheduledEmails();

    const channel = supabase
      .channel('scheduled_emails_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scheduled_emails'
      }, () => {
        loadScheduledEmails();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadScheduledEmails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('scheduled_emails')
        .select(`
          *,
          projects:project_id(title, project_reference, company_name, client_number),
          staff:user_id(full_name),
          email_accounts:from_account_id(smtp_from_email, account_name)
        `)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setScheduledEmails(data || []);
    } catch (err) {
      console.error('Error loading scheduled emails:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'sent':
        return (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Sent
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const handleSort = (field: 'scheduled_date' | 'sent_at') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleViewEmail = (email: any) => {
    setSelectedEmail(email);
    setShowDetailModal(true);
  };

  const handleEditEmail = (email: any) => {
    setSelectedEmail(email);
    setEditForm({
      subject: email.subject,
      body: email.body,
      recipient_emails: email.recipient_emails,
      scheduled_date: email.scheduled_date
    });
    setShowEditModal(true);
  };

  const handleUpdateEmail = async () => {
    if (!selectedEmail) return;

    try {
      const { error } = await supabase
        .from('scheduled_emails')
        .update({
          subject: editForm.subject,
          body: editForm.body,
          recipient_emails: editForm.recipient_emails,
          scheduled_date: editForm.scheduled_date
        })
        .eq('id', selectedEmail.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedEmail(null);
      loadScheduledEmails();
    } catch (err) {
      console.error('Error updating email:', err);
      alert('Failed to update email');
    }
  };

  const filteredAndSortedEmails = scheduledEmails
    .filter(email => {
      if (filter !== 'all' && email.status !== filter) return false;

      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      const companyName = email.projects?.company_name?.toLowerCase() || '';
      const clientNumber = email.projects?.client_number?.toLowerCase() || '';
      const projectReference = email.projects?.project_reference?.toLowerCase() || '';
      const senderEmail = email.email_accounts?.smtp_from_email?.toLowerCase() || '';
      const recipientEmails = email.recipient_emails?.join(' ').toLowerCase() || '';

      return (
        companyName.includes(query) ||
        clientNumber.includes(query) ||
        projectReference.includes(query) ||
        senderEmail.includes(query) ||
        recipientEmails.includes(query)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a[sortBy] || 0).getTime();
      const dateB = new Date(b[sortBy] || 0).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  const statusCounts = {
    all: scheduledEmails.length,
    pending: scheduledEmails.filter(e => e.status === 'pending').length,
    sent: scheduledEmails.filter(e => e.status === 'sent').length,
    failed: scheduledEmails.filter(e => e.status === 'failed').length,
    cancelled: scheduledEmails.filter(e => e.status === 'cancelled').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading scheduled emails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company name, client ID, project reference, sender email, or recipient email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleSort('scheduled_date')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
              sortBy === 'scheduled_date'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Schedule Date
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleSort('sent_at')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
              sortBy === 'sent_at'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            Sent Date
            <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            filter === 'all'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All ({statusCounts.all})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            filter === 'pending'
              ? 'bg-yellow-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Pending ({statusCounts.pending})
        </button>
        <button
          onClick={() => setFilter('sent')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            filter === 'sent'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Sent ({statusCounts.sent})
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            filter === 'failed'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Failed ({statusCounts.failed})
        </button>
        <button
          onClick={() => setFilter('cancelled')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            filter === 'cancelled'
              ? 'bg-slate-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Cancelled ({statusCounts.cancelled})
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        {filteredAndSortedEmails.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Project Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">From</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">To</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Scheduled</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Sent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAndSortedEmails.map((email) => (
                  <tr
                    key={email.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleViewEmail(email)}
                  >
                    <td className="px-4 py-3">{getStatusBadge(email.status)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onProjectClick?.(email.project_id);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                      >
                        {email.projects?.project_reference || 'N/A'}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {email.projects?.client_number && `[${email.projects.client_number}] `}
                      {email.projects?.company_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {email.email_accounts?.smtp_from_email || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div className="max-w-xs truncate">
                        {email.recipient_emails.join(', ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {new Date(email.scheduled_date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {email.sent_at ? new Date(email.sent_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewEmail(email);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {email.status === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEmail(email);
                            }}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Email"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg font-medium">
              {filter === 'all'
                ? searchQuery
                  ? 'No emails match your search'
                  : 'No scheduled emails yet'
                : `No ${filter} emails`
              }
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Schedule emails from individual project pages
            </p>
          </div>
        )}
      </div>

      {showDetailModal && selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Email Details</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {getStatusBadge(selectedEmail.status)}
                  {selectedEmail.projects?.project_reference && (
                    <span className="text-sm font-medium text-slate-700">
                      Ref: {selectedEmail.projects.project_reference}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Company</label>
                    <p className="text-slate-900 mt-1">
                      {selectedEmail.projects?.client_number && `[${selectedEmail.projects.client_number}] `}
                      {selectedEmail.projects?.company_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">From</label>
                    <p className="text-slate-900 mt-1">{selectedEmail.email_accounts?.smtp_from_email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Scheduled Date</label>
                    <p className="text-slate-900 mt-1">{new Date(selectedEmail.scheduled_date).toLocaleString()}</p>
                  </div>
                  {selectedEmail.sent_at && (
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Sent Date</label>
                      <p className="text-slate-900 mt-1">{new Date(selectedEmail.sent_at).toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Scheduled By</label>
                    <p className="text-slate-900 mt-1">{selectedEmail.staff?.full_name || 'Unknown'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">To</label>
                  <p className="text-slate-900 mt-1">{selectedEmail.recipient_emails.join(', ')}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Subject</label>
                  <p className="text-slate-900 mt-1 font-medium">{selectedEmail.subject}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Body</label>
                  <div className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-4 whitespace-pre-wrap text-slate-900">
                    {selectedEmail.body}
                  </div>
                </div>

                {selectedEmail.error_message && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
                    <strong>Error:</strong> {selectedEmail.error_message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Edit Scheduled Email</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
                  <input
                    type="text"
                    value={editForm.subject}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Body</label>
                  <textarea
                    value={editForm.body}
                    onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Recipient Emails (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.recipient_emails.join(', ')}
                    onChange={(e) => setEditForm({ ...editForm, recipient_emails: e.target.value.split(',').map(s => s.trim()) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Scheduled Date</label>
                  <input
                    type="datetime-local"
                    value={editForm.scheduled_date.slice(0, 16)}
                    onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateEmail}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Update Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
