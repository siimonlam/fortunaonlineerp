import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MarkInvoicePaidModalProps {
  invoice: {
    id: string;
    invoice_number: string;
    amount: number;
    payment_date?: string;
    payment_method?: string;
    remark?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkInvoicePaidModal({ invoice, onClose, onSuccess }: MarkInvoicePaidModalProps) {
  const [paymentDate, setPaymentDate] = useState(invoice.payment_date || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState(invoice.payment_method || 'Bank Transfer');
  const [remark, setRemark] = useState(invoice.remark || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('funding_invoice')
        .update({
          payment_status: 'Paid',
          payment_date: paymentDate,
          payment_method: paymentMethod,
          remark: remark,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error marking invoice as paid:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as paid');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Mark Invoice as Paid</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Invoice Number
            </label>
            <input
              type="text"
              value={invoice.invoice_number}
              disabled
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount
            </label>
            <input
              type="text"
              value={`HKD ${invoice.amount.toLocaleString()}`}
              disabled
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Credit Card">Credit Card</option>
              <option value="PayMe">PayMe</option>
              <option value="FPS">FPS</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Remark
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
              placeholder="Enter any additional notes about this payment..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Marking as Paid...' : 'Mark as Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
