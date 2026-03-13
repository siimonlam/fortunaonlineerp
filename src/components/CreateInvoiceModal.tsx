import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, FileText, ExternalLink, CheckCircle, Loader, AlertCircle } from 'lucide-react';

interface CreateInvoiceModalProps {
  project: any;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'form' | 'preview' | 'saving';

export function CreateInvoiceModal({ project, onClose, onSuccess }: CreateInvoiceModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [googleDocUrl, setGoogleDocUrl] = useState('');
  const [documentId, setDocumentId] = useState('');

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentStatus: 'Unpaid',
    amount: project.deposit_amount?.toString() || '',
    paymentMethod: '',
    paymentType: 'Deposit',
    remark: '',
    issuedCompany: 'Amazing Channel (HK) Limited',
    category: '',
  });

  useEffect(() => {
    async function generateInvoiceNumber() {
      if (!project.client_number) return;
      try {
        const { data, error } = await supabase.rpc('generate_invoice_number', {
          client_num: project.client_number
        });
        if (error) throw error;
        if (data) setFormData(prev => ({ ...prev, invoiceNumber: data }));
      } catch (err) {
        console.error('Error generating invoice number:', err);
      }
    }
    generateInvoiceNumber();
  }, [project.client_number]);

  async function handleGenerate() {
    if (!formData.invoiceNumber || !formData.amount) {
      setError('Invoice number and amount are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-funding-invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceNumber: formData.invoiceNumber,
          issueDate: formData.issueDate,
          dueDate: formData.dueDate,
          amount: formData.amount,
          paymentType: formData.paymentType,
          remark: formData.remark,
          issuedCompany: formData.issuedCompany,
          category: formData.category,
          companyName: project.company_name || '',
          companyNameChinese: project.company_name_chinese || '',
          contactName: project.contact_name || '',
          contactNumber: project.contact_number || '',
          address: project.address || '',
          projectTitle: project.title || '',
          projectReference: project.project_reference || project.project_reference_number || '',
          applicationNumber: project.application_number || '',
          fundingScheme: project.funding_scheme || '',
          clientNumber: project.client_number || '',
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to generate invoice document');
      }

      setGoogleDocUrl(result.googleDocUrl);
      setDocumentId(result.documentId);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to generate invoice');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalize() {
    setStep('saving');
    setLoading(true);
    setError('');

    try {
      let clientId = project.client_id;
      if (!clientId && project.client_number) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('client_number', project.client_number)
          .maybeSingle();
        if (clientData) clientId = clientData.id;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/finalize-funding-invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceData: formData,
          documentId,
          invoiceNumber: formData.invoiceNumber,
          projectId: project.id,
          clientId,
          companyName: project.company_name || '',
          projectReference: project.project_reference || project.project_reference_number || '',
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to finalize invoice');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to finalize invoice');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'preview' || step === 'saving') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Invoice Preview</h2>
                <p className="text-xs text-slate-500">Review and edit in Google Docs, then finalize to save as PDF</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={googleDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Google Docs
              </a>
              <button
                onClick={() => setStep('form')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <iframe
              src={googleDocUrl.replace('/edit', '/edit?embedded=true&rm=minimal')}
              className="w-full h-full border-0"
              title="Invoice Preview"
            />
          </div>

          {error && (
            <div className="px-6 py-2 bg-red-50 border-t border-red-200 flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
            <div className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">{formData.invoiceNumber}</span>
              {' · '}
              {project.company_name}
              {' · '}
              HK${parseFloat(formData.amount || '0').toLocaleString()}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('form')}
                disabled={loading}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleFinalize}
                disabled={loading}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Finalize & Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-800">Create Invoice</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
            <p className="text-sm text-blue-800">
              <strong>Project:</strong> {project.company_name || 'N/A'}
              {project.project_reference || project.project_reference_number ? (
                <span className="ml-3"><strong>Ref:</strong> {project.project_reference || project.project_reference_number}</span>
              ) : null}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number *</label>
                <input
                  type="text"
                  required
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="INV-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (HKD) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Issue Date</label>
                <input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                <select
                  value={formData.paymentStatus}
                  onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Unpaid">Unpaid</option>
                  <option value="Void">Void</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Type</label>
                <select
                  value={formData.paymentType}
                  onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Deposit">Deposit</option>
                  <option value="2nd Payment">2nd Payment</option>
                  <option value="3rd Payment">3rd Payment</option>
                  <option value="Final Payment">Final Payment</option>
                  <option value="Others">Others</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Issued Company</label>
                <input
                  type="text"
                  value={formData.issuedCompany}
                  onChange={(e) => setFormData({ ...formData, issuedCompany: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Amazing Channel (HK) Limited"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Website">Website</option>
                  <option value="Production">Production</option>
                  <option value="BUD">BUD</option>
                  <option value="TVP">TVP</option>
                  <option value="Platform">Platform</option>
                  <option value="Others">Others</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
              <input
                type="text"
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Bank Transfer, Cheque, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remark</label>
              <textarea
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Add any additional notes or remarks..."
                rows={3}
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Template Placeholders</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                <span><code className="bg-slate-100 px-1 rounded">{'{{INVOICE_NUMBER}}'}</code> Invoice Number</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{ISSUE_DATE}}'}</code> Issue Date</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{DUE_DATE}}'}</code> Due Date</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{AMOUNT}}'}</code> Amount</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{PAYMENT_TYPE}}'}</code> Payment Type</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{COMPANY_NAME}}'}</code> Company Name</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{COMPANY_NAME_CHINESE}}'}</code> Chinese Name</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{CONTACT_NAME}}'}</code> Contact Name</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{PROJECT_REFERENCE}}'}</code> Project Ref</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{APPLICATION_NUMBER}}'}</code> App Number</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{FUNDING_SCHEME}}'}</code> Funding Scheme</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{ISSUED_COMPANY}}'}</code> Issued Company</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{CATEGORY}}'}</code> Category</span>
                <span><code className="bg-slate-100 px-1 rounded">{'{{REMARK}}'}</code> Remark</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-200 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !formData.invoiceNumber || !formData.amount}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate & Preview
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
