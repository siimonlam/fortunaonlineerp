import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserCheck, Clock, CheckCircle, XCircle, Mail, Building2, Phone, Briefcase } from 'lucide-react';

interface FundingClient {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  industry: string;
  is_approved: boolean;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export function FundingClientApproval() {
  const [clients, setClients] = useState<FundingClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');

  useEffect(() => {
    loadClients();
  }, [filter]);

  async function loadClients() {
    setLoading(true);
    try {
      let query = supabase
        .from('funding_clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('is_approved', false);
      } else if (filter === 'approved') {
        query = query.eq('is_approved', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('Error loading clients:', error);
      alert('Failed to load clients: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function approveClient(clientId: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('funding_clients')
        .update({
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (error) throw error;

      alert('Client approved successfully!');
      await loadClients();
    } catch (error: any) {
      console.error('Error approving client:', error);
      alert('Failed to approve client: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function revokeApproval(clientId: string) {
    if (!confirm('Are you sure you want to revoke approval for this client?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('funding_clients')
        .update({
          is_approved: false,
          approved_by: null,
          approved_at: null
        })
        .eq('id', clientId);

      if (error) throw error;

      alert('Approval revoked successfully!');
      await loadClients();
    } catch (error: any) {
      console.error('Error revoking approval:', error);
      alert('Failed to revoke approval: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingCount = clients.filter(c => !c.is_approved).length;
  const approvedCount = clients.filter(c => c.is_approved).length;

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <UserCheck className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">Funding Client Approvals</h2>
        </div>
        <p className="text-slate-600">Review and approve client registrations to grant access to the onboarding portal</p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({clients.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'approved'
                ? 'bg-green-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Approved ({approvedCount})
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading && clients.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-slate-600">Loading clients...</div>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No clients found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map((client) => (
              <div
                key={client.id}
                className="border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="w-5 h-5 text-slate-600" />
                      <h3 className="text-lg font-semibold text-slate-900">
                        {client.company_name}
                      </h3>
                      {client.is_approved ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="w-4 h-4" />
                        <span>{client.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-4 h-4" />
                        <span>{client.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Briefcase className="w-4 h-4" />
                        <span>{client.industry}</span>
                      </div>
                      <div className="text-slate-500">
                        Contact: {client.contact_name}
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      Registered: {formatDate(client.created_at)}
                      {client.approved_at && (
                        <span className="ml-3">
                          Approved: {formatDate(client.approved_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {!client.is_approved ? (
                      <button
                        onClick={() => approveClient(client.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                    ) : (
                      <button
                        onClick={() => revokeApproval(client.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        <XCircle className="w-4 h-4" />
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
