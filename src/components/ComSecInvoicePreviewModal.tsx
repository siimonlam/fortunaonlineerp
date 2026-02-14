import { useState } from 'react';
import { X, ExternalLink, FileText, DollarSign, Ban, CheckCircle, Receipt as ReceiptIcon, Calendar, AlertCircle, Download, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ComSecInvoicePreviewModalProps {
  invoice: {
    id: string;
    invoice_number: string;
    comsec_client_id: string;
    issue_date: string;
    due_date: string;
    amount: number;
    status: string;
    description: string | null;
    payment_date: string | null;
    payment_method: string | null;
    google_drive_url: string | null;
    pdf_url: string | null;
    remarks: string | null;
  };
  clientName: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ComSecInvoicePreviewModal({ invoice, clientName, onClose, onUpdate }: ComSecInvoicePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [paymentDate, setPaymentDate] = useState(invoice.payment_date || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState(invoice.payment_method || '');
  const [voidReason, setVoidReason] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const handleMarkAsPaid = async () => {
    if (!paymentDate) {
      alert('Please select a payment date');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comsec_invoices')
        .update({
          status: 'Paid',
          payment_date: paymentDate,
          payment_method: paymentMethod || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (error) throw error;

      alert('Invoice marked as paid successfully');
      setShowMarkPaidModal(false);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      alert('Failed to mark invoice as paid');
    } finally {
      setLoading(false);
    }
  };

  const handleVoid = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('comsec_invoices')
        .update({
          status: 'Void',
          remarks: voidReason ? `VOIDED: ${voidReason}` : 'VOIDED',
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (error) throw error;

      alert('Invoice voided successfully');
      setShowVoidConfirm(false);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error voiding invoice:', error);
      alert('Failed to void invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReceipt = async () => {
    if (invoice.status !== 'Paid') {
      alert('Invoice must be paid before generating a receipt');
      return;
    }

    alert('Receipt generation feature will be implemented');
  };

  const handleDownloadPDF = async () => {
    if (!invoice.pdf_url) {
      alert('PDF not available. Please generate PDF first.');
      return;
    }

    try {
      const response = await fetch(invoice.pdf_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  const handleEmailInvoice = async () => {
    if (!invoice.pdf_url) {
      alert('PDF not available. Please generate PDF first.');
      return;
    }

    alert('Email sending feature will be implemented. This will send the invoice PDF to the client.');
  };

  const handleMarkAsUnpaid = async () => {
    if (!confirm('Are you sure you want to mark this invoice as unpaid?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comsec_invoices')
        .update({
          status: 'Unpaid',
          payment_date: null,
          payment_method: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (error) throw error;

      alert('Invoice marked as unpaid');
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error marking invoice as unpaid:', error);
      alert('Failed to mark invoice as unpaid');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizePDF = async () => {
    if (!invoice.google_drive_url) {
      alert('Google Drive URL not found');
      return;
    }

    if (!confirm('Generate PDF from this draft invoice? This will finalize the invoice.')) {
      return;
    }

    // Extract document ID from Google Drive URL
    const match = invoice.google_drive_url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      alert('Could not extract document ID from Google Drive URL');
      return;
    }

    const documentId = match[1];

    setGeneratingPDF(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finalize-comsec-invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          documentId: documentId,
          invoiceNumber: invoice.invoice_number,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const result = await response.json();
      alert(`PDF generated successfully!\nInvoice Number: ${result.invoiceNumber}\nStatus: Unpaid`);

      if (onUpdate) onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error.message}`);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-slate-100 text-slate-700';
      case 'Unpaid':
        return 'bg-yellow-100 text-yellow-800';
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      case 'Void':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const isOverdue = invoice.status === 'Unpaid' && new Date(invoice.due_date) < new Date();

  if (showVoidConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Ban className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Void Invoice</h3>
              <p className="text-sm text-slate-600">Invoice: {invoice.invoice_number}</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reason for voiding (optional)
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
              rows={3}
              placeholder="Enter reason for voiding this invoice..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowVoidConfirm(false)}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleVoid}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Voiding...' : 'Void Invoice'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showMarkPaidModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Mark as Paid</h3>
              <p className="text-sm text-slate-600">Invoice: {invoice.invoice_number}</p>
            </div>
          </div>

          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
              >
                <option value="">Select payment method</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="PayPal">PayPal</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Invoice Amount</p>
                  <p className="text-lg font-bold">${invoice.amount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowMarkPaidModal(false)}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkAsPaid}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Mark as Paid'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Invoice Preview</h2>
            <p className="text-sm text-slate-600 mt-0.5">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-slate-600 mb-1">Invoice Number</div>
                <div className="text-lg font-bold text-slate-900">{invoice.invoice_number}</div>
              </div>

              <div>
                <div className="text-sm text-slate-600 mb-1">Status</div>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(isOverdue ? 'Overdue' : invoice.status)}`}>
                  {isOverdue ? 'Overdue' : invoice.status}
                </span>
              </div>

              <div>
                <div className="text-sm text-slate-600 mb-1">Issue Date</div>
                <div className="font-medium text-slate-900">{new Date(invoice.issue_date).toLocaleDateString()}</div>
              </div>

              <div>
                <div className="text-sm text-slate-600 mb-1">Due Date</div>
                <div className="font-medium text-slate-900">{new Date(invoice.due_date).toLocaleDateString()}</div>
              </div>

              <div>
                <div className="text-sm text-slate-600 mb-1">Amount</div>
                <div className="text-xl font-bold text-slate-900">${invoice.amount.toFixed(2)}</div>
              </div>

              {invoice.payment_date && (
                <div>
                  <div className="text-sm text-slate-600 mb-1">Payment Date</div>
                  <div className="font-medium text-green-700">{new Date(invoice.payment_date).toLocaleDateString()}</div>
                </div>
              )}

              {invoice.payment_method && (
                <div>
                  <div className="text-sm text-slate-600 mb-1">Payment Method</div>
                  <div className="font-medium text-slate-900">{invoice.payment_method}</div>
                </div>
              )}
            </div>

            {invoice.description && (
              <div className="mt-4 pt-4 border-t border-slate-300">
                <div className="text-sm text-slate-600 mb-1">Description</div>
                <div className="text-slate-900">{invoice.description}</div>
              </div>
            )}

            {invoice.remarks && (
              <div className="mt-4 pt-4 border-t border-slate-300">
                <div className="text-sm text-slate-600 mb-1">Remarks</div>
                <div className="text-slate-900">{invoice.remarks}</div>
              </div>
            )}
          </div>

          {invoice.pdf_url && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-900">PDF Invoice</div>
                    <div className="text-sm text-green-700">Ready to send version</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={handleEmailInvoice}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                  <a
                    href={invoice.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View
                  </a>
                </div>
              </div>
            </div>
          )}

          {invoice.google_drive_url && !invoice.pdf_url && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-blue-900">Draft Invoice (Google Docs)</div>
                    <div className="text-sm text-blue-700">This invoice is still in draft. Edit in Google Docs or finalize to PDF.</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={invoice.google_drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Edit in Docs
                  </a>
                  <button
                    onClick={handleFinalizePDF}
                    disabled={generatingPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-4 h-4" />
                    {generatingPDF ? 'Generating...' : 'Finalize PDF'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isOverdue && invoice.status !== 'Paid' && invoice.status !== 'Void' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Invoice Overdue</div>
                  <div className="text-sm">This invoice is past its due date and requires attention</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {invoice.status !== 'Void' && invoice.status !== 'Draft' && (
                <>
                  {invoice.status !== 'Paid' && (
                    <button
                      onClick={() => setShowMarkPaidModal(true)}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <DollarSign className="w-4 h-4" />
                      Mark as Paid
                    </button>
                  )}

                  {invoice.status === 'Paid' && (
                    <>
                      <button
                        onClick={handleGenerateReceipt}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <ReceiptIcon className="w-4 h-4" />
                        Generate Receipt
                      </button>
                      <button
                        onClick={handleMarkAsUnpaid}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        <Calendar className="w-4 h-4" />
                        Mark as Unpaid
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setShowVoidConfirm(true)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4" />
                    Void
                  </button>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
