import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Clock, CheckCircle, XCircle, ExternalLink, Calendar, Send } from 'lucide-react';

interface ScheduledEmailsPageProps {
  onProjectClick?: (projectId: string) => void;
}

export function ScheduledEmailsPage({ onProjectClick }: ScheduledEmailsPageProps) {
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed' | 'cancelled'>('all');

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
          staff:user_id(full_name)
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

  const filteredEmails = scheduledEmails.filter(email =>
    filter === 'all' ? true : email.status === filter
  );

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
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Scheduled Emails</h1>
            <p className="text-blue-100">Manage all scheduled emails for funding projects</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold">{scheduledEmails.length}</div>
            <div className="text-blue-100 text-sm font-medium">Total Emails</div>
          </div>
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

      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        {filteredEmails.length > 0 ? (
          <div className="space-y-4">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                className="bg-slate-50 rounded-lg border border-slate-200 p-5 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      {getStatusBadge(email.status)}
                      <button
                        onClick={() => onProjectClick?.(email.project_id)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                      >
                        {email.projects?.client_number && `[${email.projects.client_number}] `}
                        {email.projects?.title || 'Unknown Project'}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg mb-2">{email.subject}</h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3 mb-3 bg-white p-3 rounded border border-slate-200">
                      {email.body}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-medium">
                        <Send className="w-3 h-3" />
                        To: {email.recipient_emails.join(', ')}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3" />
                        Scheduled: {new Date(email.scheduled_date).toLocaleString()}
                      </span>
                      {email.sent_at && (
                        <span className="flex items-center gap-1 font-medium text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Sent: {new Date(email.sent_at).toLocaleString()}
                        </span>
                      )}
                      <span className="font-medium">By: {email.staff?.full_name || 'Unknown'}</span>
                    </div>
                    {email.error_message && (
                      <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">
                        <strong>Error:</strong> {email.error_message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg font-medium">
              {filter === 'all'
                ? 'No scheduled emails yet'
                : `No ${filter} emails`
              }
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Schedule emails from individual project pages
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
