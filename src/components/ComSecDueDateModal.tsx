import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, AlertCircle, Calendar, FileText, Mail, Bell, DollarSign, CheckCircle2 } from 'lucide-react';

interface ComSecClient {
  id: string;
  company_code: string;
  company_name: string;
  ar_due_date: string | null;
  reminder_days: number | null;
  case_officer?: { full_name: string };
}

interface Invoice {
  id: string;
  invoice_number: string;
  due_date: string;
  amount: number;
  comsec_client: { company_name: string; company_code: string };
}

interface Letter {
  id: string;
  sender_name: string;
  letter_received_date: string;
  comsec_client: { company_name: string; company_code: string };
}

interface DueDateItem {
  id: string;
  type: 'ar' | 'invoice' | 'letter';
  companyCode: string;
  companyName: string;
  dueDate: string;
  description: string;
  amount?: number;
  daysUntilDue: number;
  isPastDue: boolean;
  reminderDays?: number;
}

interface ComSecDueDateModalProps {
  onClose: () => void;
}

export function ComSecDueDateModal({ onClose }: ComSecDueDateModalProps) {
  const { user } = useAuth();
  const [dueDateItems, setDueDateItems] = useState<DueDateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDueDates();
  }, [user]);

  async function loadDueDates() {
    if (!user) return;

    setLoading(true);
    try {
      await Promise.all([
        loadARDueDates(),
        loadInvoiceDueDates(),
        loadPendingLetters(),
      ]);
    } catch (error) {
      console.error('[ComSecDueDateModal] Error loading due dates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadARDueDates() {
    const { data, error } = await supabase
      .from('comsec_clients')
      .select(`
        id,
        company_code,
        company_name,
        ar_due_date,
        reminder_days,
        case_officer:staff!case_officer_id(full_name)
      `)
      .not('ar_due_date', 'is', null)
      .order('ar_due_date', { ascending: true });

    if (error) {
      console.error('[ComSecDueDateModal] Error loading AR due dates:', error);
      return;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const items: DueDateItem[] = (data || [])
      .map(client => {
        const dueDate = new Date(client.ar_due_date!);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Show if past due or within reminder window (default 30 days if not set)
        const reminderWindow = client.reminder_days || 30;
        if (daysUntilDue > reminderWindow) return null;

        return {
          id: client.id,
          type: 'ar' as const,
          companyCode: client.company_code,
          companyName: client.company_name,
          dueDate: client.ar_due_date!,
          description: 'Annual Return Due',
          daysUntilDue,
          isPastDue: daysUntilDue < 0,
          reminderDays: client.reminder_days,
        };
      })
      .filter(item => item !== null) as DueDateItem[];

    setDueDateItems(prev => [...prev, ...items]);
  }

  async function loadInvoiceDueDates() {
    const { data, error } = await supabase
      .from('comsec_invoices')
      .select(`
        id,
        invoice_number,
        due_date,
        amount,
        comsec_client:comsec_clients(company_name, company_code)
      `)
      .eq('status', 'pending')
      .order('due_date', { ascending: true });

    if (error) {
      console.error('[ComSecDueDateModal] Error loading invoices:', error);
      return;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const items: DueDateItem[] = (data || [])
      .filter(invoice => {
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        // Show past due or due within next 30 days
        return dueDate <= thirtyDaysFromNow;
      })
      .map(invoice => {
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: invoice.id,
          type: 'invoice' as const,
          companyCode: invoice.comsec_client.company_code,
          companyName: invoice.comsec_client.company_name,
          dueDate: invoice.due_date,
          description: `Invoice ${invoice.invoice_number}`,
          amount: invoice.amount,
          daysUntilDue,
          isPastDue: daysUntilDue < 0,
        };
      });

    setDueDateItems(prev => [...prev, ...items]);
  }

  async function loadPendingLetters() {
    const { data, error } = await supabase
      .from('virtual_office_letters')
      .select(`
        id,
        sender_name,
        letter_received_date,
        comsec_client:comsec_clients(company_name, company_code)
      `)
      .is('pickup_date', null)
      .order('letter_received_date', { ascending: true });

    if (error) {
      console.error('[ComSecDueDateModal] Error loading letters:', error);
      return;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const items: DueDateItem[] = (data || [])
      .map(letter => {
        const receivedDate = new Date(letter.letter_received_date);
        receivedDate.setHours(0, 0, 0, 0);
        const daysSinceReceived = Math.floor((now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));

        // Show letters received more than 3 days ago
        if (daysSinceReceived < 3) return null;

        return {
          id: letter.id,
          type: 'letter' as const,
          companyCode: letter.comsec_client.company_code,
          companyName: letter.comsec_client.company_name,
          dueDate: letter.letter_received_date,
          description: `Letter from ${letter.sender_name}`,
          daysUntilDue: -daysSinceReceived,
          isPastDue: true,
        };
      })
      .filter(item => item !== null) as DueDateItem[];

    setDueDateItems(prev => [...prev, ...items]);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  }

  function formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-HK', {
      style: 'currency',
      currency: 'HKD',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  function getDaysText(daysUntilDue: number, type: string): string {
    if (type === 'letter') {
      const daysSinceReceived = Math.abs(daysUntilDue);
      return `${daysSinceReceived} ${daysSinceReceived === 1 ? 'day' : 'days'} awaiting pickup`;
    }

    if (daysUntilDue < 0) {
      const daysOverdue = Math.abs(daysUntilDue);
      return `${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue`;
    } else if (daysUntilDue === 0) {
      return 'Due today';
    } else {
      return `Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}`;
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case 'ar':
        return <FileText className="w-5 h-5" />;
      case 'invoice':
        return <DollarSign className="w-5 h-5" />;
      case 'letter':
        return <Mail className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  }

  function getColorClass(item: DueDateItem): string {
    if (item.type === 'letter') {
      return 'border-purple-200 bg-purple-50';
    }

    if (item.isPastDue) {
      return 'border-red-200 bg-red-50';
    } else if (item.daysUntilDue === 0) {
      return 'border-amber-200 bg-amber-50';
    } else if (item.daysUntilDue <= 7) {
      return 'border-orange-200 bg-orange-50';
    } else {
      return 'border-blue-200 bg-blue-50';
    }
  }

  function getBadgeClass(item: DueDateItem): string {
    if (item.type === 'letter') {
      return 'bg-purple-600 text-white';
    }

    if (item.isPastDue) {
      return 'bg-red-600 text-white';
    } else if (item.daysUntilDue === 0) {
      return 'bg-amber-600 text-white';
    } else if (item.daysUntilDue <= 7) {
      return 'bg-orange-600 text-white';
    } else {
      return 'bg-blue-600 text-white';
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading due dates...</p>
          </div>
        </div>
      </div>
    );
  }

  // Sort by urgency: past due first, then by days until due
  const sortedItems = [...dueDateItems].sort((a, b) => {
    if (a.isPastDue && !b.isPastDue) return -1;
    if (!a.isPastDue && b.isPastDue) return 1;
    return a.daysUntilDue - b.daysUntilDue;
  });

  const pastDueCount = dueDateItems.filter(item => item.isPastDue).length;
  const dueSoonCount = dueDateItems.filter(item => !item.isPastDue && item.daysUntilDue <= 7).length;
  const upcomingCount = dueDateItems.filter(item => !item.isPastDue && item.daysUntilDue > 7).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              ComSec Due Date Reminders
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {dueDateItems.length === 0
                ? 'All up to date - no upcoming deadlines'
                : `${dueDateItems.length} item${dueDateItems.length !== 1 ? 's' : ''} requiring attention`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {dueDateItems.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className={`text-3xl font-bold ${pastDueCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {pastDueCount}
                </div>
                <div className="text-xs text-slate-600 font-medium mt-1">Overdue</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${dueSoonCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {dueSoonCount}
                </div>
                <div className="text-xs text-slate-600 font-medium mt-1">Due Within 7 Days</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${upcomingCount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                  {upcomingCount}
                </div>
                <div className="text-xs text-slate-600 font-medium mt-1">Upcoming</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {dueDateItems.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">All Clear!</h3>
              <p className="text-slate-600">
                No upcoming due dates or pending items at the moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map(item => (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`rounded-lg p-4 border-2 transition-all hover:shadow-md ${getColorClass(item)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg ${item.isPastDue || item.type === 'letter' ? 'bg-white/50' : 'bg-white/80'}`}>
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900">{item.companyName}</h4>
                          <p className="text-sm text-slate-600">{item.companyCode}</p>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded ${getBadgeClass(item)}`}>
                          {getDaysText(item.daysUntilDue, item.type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-700">{item.description}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-600">
                            {item.type === 'letter' ? 'Received' : 'Due'}: {formatDate(item.dueDate)}
                          </span>
                        </div>
                        {item.amount && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4 text-slate-500" />
                            <span className="font-semibold text-slate-700">{formatAmount(item.amount)}</span>
                          </div>
                        )}
                      </div>
                      {item.type === 'ar' && item.reminderDays && (
                        <p className="text-xs text-slate-500 mt-2">
                          Reminder set for {item.reminderDays} days before due date
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
