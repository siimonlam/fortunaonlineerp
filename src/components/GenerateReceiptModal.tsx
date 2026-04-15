import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, FileText } from 'lucide-react';

interface GenerateReceiptModalProps {
  invoice: {
    id: string;
    invoice_number: string;
    amount: number;
    project_id: string;
    project_reference?: string;
    payment_date?: string;
    payment_method?: string;
    remark?: string;
  };
  project: {
    company_name?: string;
    company_name_chinese?: string;
    contact_name?: string;
    contact_number?: string;
    address?: string;
    application_number?: string;
    funding_scheme?: string | number;
    client_number?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function GenerateReceiptModal({ invoice, project, onClose, onSuccess }: GenerateReceiptModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoiceNumber: invoice.invoice_number,
    receiptDate: new Date().toISOString().split('T')[0],
    paymentDate: invoice.payment_date || new Date().toISOString().split('T')[0],
    paymentAmount: invoice.amount ? invoice.amount.toString() : '',
    paymentMethod: invoice.payment_method || 'Bank Transfer',
    paymentMethodRemark: invoice.remark || '',
  });

  async function generateReceiptNumber() {
    const { data, error } = await supabase.rpc('generate_receipt_number');
    if (error) {
      console.error('Error generating receipt number:', error);
      return `REC${Date.now()}`;
    }
    return data;
  }

  async function handleGenerateReceipt() {
    if (!formData.paymentAmount || parseFloat(formData.paymentAmount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setLoading(true);
    try {
      const receiptNumber = await generateReceiptNumber();
      const { data: { user } } = await supabase.auth.getUser();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-funding-receipt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiptNumber,
          receiptDate: formData.receiptDate,
          invoiceId: invoice.id,
          invoiceNumber: formData.invoiceNumber,
          projectId: invoice.project_id,
          projectReference: invoice.project_reference || '',
          paymentDate: formData.paymentDate,
          paymentAmount: parseFloat(formData.paymentAmount),
          paymentMethod: formData.paymentMethod,
          paymentMethodRemark: formData.paymentMethodRemark,
          companyName: project.company_name || '',
          companyNameChinese: project.company_name_chinese || '',
          contactName: project.contact_name || '',
          contactNumber: project.contact_number || '',
          address: project.address || '',
          applicationNumber: project.application_number || '',
          fundingScheme: project.funding_scheme?.toString() || '',
          clientNumber: project.client_number || '',
          createdBy: user?.id || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate receipt');
      }

      alert(`Receipt ${receiptNumber} generated successfully!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error generating receipt:', error);
      alert(`Failed to generate receipt: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-800">Generate Receipt</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Receipt Date
              </label>
              <input
                type="date"
                value={formData.receiptDate}
                onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.paymentAmount}
                onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Method Remark
              </label>
              <input
                type="text"
                value={formData.paymentMethodRemark}
                onChange={(e) => setFormData({ ...formData, paymentMethodRemark: e.target.value })}
                placeholder="e.g., Cheque #12345, Transaction ID, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {project.company_name && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 font-medium mb-1">Receipt will be generated for:</p>
              <p className="text-sm text-slate-700 font-medium">{project.company_name}</p>
              {project.company_name_chinese && (
                <p className="text-sm text-slate-600">{project.company_name_chinese}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateReceipt}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
