import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Plus, Trash2, Clock, Send, X, AlertCircle, CheckCircle } from 'lucide-react';

interface ScheduledEmail {
  id: string;
  project_id: string;
  user_id: string;
  from_account_id: string;
  recipient_emails: string[];
  subject: string;
  body: string;
  scheduled_date: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at?: string;
  error_message?: string;
  created_at: string;
  staff?: {
    full_name: string;
  };
  email_account?: {
    account_name: string;
    smtp_from_email: string;
  };
}

interface EmailAccount {
  id: string;
  account_name: string;
  smtp_from_email: string;
  is_active: boolean;
}

interface EmailSchedulerTabProps {
  projectId: string;
  projectTitle: string;
  clientEmails?: string;
}

export function EmailSchedulerTab({ projectId, projectTitle, clientEmails }: EmailSchedulerTabProps) {
  const { user } = useAuth();
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    from_account_id: '',
    recipient_emails: clientEmails || '',
    subject: '',
    body: '',
    scheduled_date: '',
    scheduled_time: ''
  });

  useEffect(() => {
    fetchEmailAccounts();
    fetchScheduledEmails();
    fetchEmailTemplates();

    const channel = supabase
      .channel('scheduled_emails_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scheduled_emails',
        filter: `project_id=eq.${projectId}`
      }, () => {
        fetchScheduledEmails();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchEmailAccounts = async () => {
    const { data, error } = await supabase
      .from('email_accounts')
      .select('id, account_name, smtp_from_email, is_active')
      .eq('is_active', true)
      .order('account_name', { ascending: true });

    if (!error && data) {
      setEmailAccounts(data);
      if (data.length > 0 && !formData.from_account_id) {
        setFormData(prev => ({ ...prev, from_account_id: data[0].id }));
      }
    }
  };

  const fetchScheduledEmails = async () => {
    const { data, error } = await supabase
      .from('scheduled_emails')
      .select(`
        *,
        staff:user_id(full_name),
        email_account:from_account_id(account_name, smtp_from_email)
      `)
      .eq('project_id', projectId)
      .order('scheduled_date', { ascending: true });

    if (!error && data) {
      setEmails(data);
    }
  };

  const fetchEmailTemplates = async () => {
    const { data } = await supabase
      .from('share_resources')
      .select('*')
      .eq('resource_type', 'email')
      .order('created_at', { ascending: false });

    if (data) {
      setEmailTemplates(data);
    }
  };

  const showErrorPopup = (message: string) => {
    setErrorMessage(message);
    setShowError(true);
  };

  const openScheduleModal = () => {
    if (emailAccounts.length === 0) {
      showErrorPopup('No email accounts configured. Please ask your administrator to set up an email account in Admin → Email Settings.');
      return;
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.from_account_id) {
      showErrorPopup('Please select an email account to send from.');
      return;
    }

    const recipientList = formData.recipient_emails
      .split(',')
      .map(email => email.trim())
      .filter(email => email);

    if (recipientList.length === 0) {
      showErrorPopup('Please enter at least one recipient email');
      return;
    }

    const scheduledDateTime = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`);

    const { error } = await supabase
      .from('scheduled_emails')
      .insert({
        project_id: projectId,
        user_id: user.id,
        from_account_id: formData.from_account_id,
        recipient_emails: recipientList,
        subject: formData.subject,
        body: formData.body,
        scheduled_date: scheduledDateTime.toISOString(),
        status: 'pending'
      });

    if (!error) {
      fetchScheduledEmails();
      resetForm();
    } else {
      showErrorPopup(`Error scheduling email: ${error.message}`);
    }
  };

  const deleteEmail = async (emailId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled email?')) return;

    const { error } = await supabase
      .from('scheduled_emails')
      .delete()
      .eq('id', emailId);

    if (!error) {
      fetchScheduledEmails();
    }
  };

  const cancelEmail = async (emailId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) return;

    const { error } = await supabase
      .from('scheduled_emails')
      .update({ status: 'cancelled' })
      .eq('id', emailId);

    if (!error) {
      fetchScheduledEmails();
    }
  };

  const resetForm = () => {
    const firstAccount = emailAccounts.length > 0 ? emailAccounts[0] : null;
    setFormData({
      from_account_id: firstAccount?.id || '',
      recipient_emails: clientEmails || '',
      subject: '',
      body: '',
      scheduled_date: '',
      scheduled_time: ''
    });
    setShowModal(false);
  };

  const applyTemplate = (template: any) => {
    let body = template.content;
    body = body.replace(/\{\{project_name\}\}/g, projectTitle);
    setFormData({ ...formData, subject: template.title, body });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>;
      case 'sent':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Sent</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Failed</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Scheduled Emails</h3>
          <p className="text-sm text-slate-600 mt-1">Schedule emails to be sent for this project</p>
        </div>
        <button
          onClick={openScheduleModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule Email
        </button>
      </div>

      {emailAccounts.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">No email accounts configured</p>
              <p className="text-sm text-yellow-700 mt-1">
                Contact your administrator to set up an email account in Admin → Email Settings before scheduling emails.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {emails.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No scheduled emails yet</p>
            <p className="text-sm text-slate-400 mt-1">Click "Schedule Email" to create one</p>
          </div>
        ) : (
          emails.map(email => (
            <div key={email.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 truncate">{email.subject}</h4>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <span>To: {email.recipient_emails.join(', ')}</span>
                      </div>
                      {email.email_account && (
                        <div className="text-xs text-slate-500 mt-1">
                          From: {email.email_account.account_name} ({email.email_account.smtp_from_email})
                        </div>
                      )}
                    </div>
                    {getStatusBadge(email.status)}
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3 mb-2">{email.body}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Scheduled: {new Date(email.scheduled_date).toLocaleString()}</span>
                    {email.sent_at && <span>Sent: {new Date(email.sent_at).toLocaleString()}</span>}
                    <span>By: {email.staff?.full_name || 'Unknown'}</span>
                  </div>
                  {email.error_message && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                      {email.error_message}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {email.status === 'pending' && (
                    <button
                      onClick={() => cancelEmail(email.id)}
                      className="p-2 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {email.user_id === user?.id && (
                    <button
                      onClick={() => deleteEmail(email.id)}
                      className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Cannot Schedule Email</h3>
                </div>
              </div>
              <p className="text-slate-700 mb-6">{errorMessage}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowError(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Schedule Email</h3>
                <button
                  onClick={resetForm}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {emailTemplates.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Use Email Template (Optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {emailTemplates.map(template => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                      >
                        {template.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Send From <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.from_account_id}
                    onChange={(e) => setFormData({ ...formData, from_account_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select email account</option>
                    {emailAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} ({account.smtp_from_email})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Choose which email account to send from</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Recipient Emails *
                  </label>
                  <input
                    type="text"
                    value={formData.recipient_emails}
                    onChange={(e) => setFormData({ ...formData, recipient_emails: e.target.value })}
                    placeholder="email1@example.com, email2@example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Separate multiple emails with commas</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Email subject"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Body *
                  </label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    rows={10}
                    placeholder="Email content..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Schedule Date *
                    </label>
                    <input
                      type="date"
                      value={formData.scheduled_date}
                      onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Schedule Time *
                    </label>
                    <input
                      type="time"
                      value={formData.scheduled_time}
                      onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Schedule Email
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
