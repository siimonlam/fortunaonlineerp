import { useState } from 'react';
import { X, ExternalLink, FileText, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ComSecReceiptPreviewModalProps {
  invoice: {
    id: string;
    invoice_number: string;
    comsec_client_id: string;
    amount: number;
    payment_date: string | null;
    payment_method: string | null;
  };
  clientName: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ComSecReceiptPreviewModal({ invoice, clientName, onClose, onUpdate }: ComSecReceiptPreviewModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [receiptData, setReceiptData] = useState({
    receipt_date: invoice.payment_date || new Date().toISOString().split('T')[0],
    amount: invoice.amount,
    payment_method: invoice.payment_method || 'Cash',
    payment_reference: '',
    remarks: ''
  });
  const [googleDriveUrl, setGoogleDriveUrl] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);

  const handleGenerateDraft = async () => {
    setLoading(true);
    try {
      const { data: receiptNumberData, error: receiptNumberError } = await supabase
        .rpc('generate_comsec_receipt_number');

      if (receiptNumberError) throw receiptNumberError;

      const generatedReceiptNumber = receiptNumberData as string;
      setReceiptNumber(generatedReceiptNumber);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-comsec-receipt-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiptNumber: generatedReceiptNumber,
          clientName: clientName,
          amount: receiptData.amount,
          receiptDate: receiptData.receipt_date,
          paymentMethod: receiptData.payment_method,
          paymentReference: receiptData.payment_reference,
          remarks: receiptData.remarks,
          invoiceNumber: invoice.invoice_number,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate receipt draft');
      }

      const result = await response.json();
      setGoogleDriveUrl(result.googleDocUrl);
      alert('Receipt draft generated successfully! Review it in Google Docs.');
    } catch (error: any) {
      console.error('Error generating receipt draft:', error);
      alert(`Failed to generate receipt draft: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizePDF = async () => {
    if (!googleDriveUrl || !receiptNumber) {
      alert('Please generate draft first');
      return;
    }

    if (!confirm('Finalize and save receipt PDF? This will save the receipt to the database.')) {
      return;
    }

    const match = googleDriveUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      alert('Could not extract document ID from Google Drive URL');
      return;
    }

    const documentId = match[1];

    setGeneratingPDF(true);
    try {
      const { data: receipt, error: insertError } = await supabase
        .from('comsec_receipts')
        .insert({
          comsec_client_id: invoice.comsec_client_id,
          comsec_invoice_id: invoice.id,
          receipt_number: receiptNumber,
          receipt_date: receiptData.receipt_date,
          amount: receiptData.amount,
          payment_method: receiptData.payment_method,
          payment_reference: receiptData.payment_reference || null,
          remarks: receiptData.remarks || null,
          google_drive_url: googleDriveUrl,
          created_by: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const pdfResponse = await fetch(`https://docs.google.com/document/d/${documentId}/export?format=pdf`);

      if (!pdfResponse.ok) {
        throw new Error('Failed to export PDF from Google Docs');
      }

      const pdfBlob = await pdfResponse.blob();
      const fileName = `${receiptNumber}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('comsec-documents')
        .upload(`receipts/${fileName}`, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('comsec-documents')
        .getPublicUrl(`receipts/${fileName}`);

      const { error: updateError } = await supabase
        .from('comsec_receipts')
        .update({ pdf_url: publicUrl })
        .eq('id', receipt.id);

      if (updateError) throw updateError;

      alert(`Receipt generated successfully!\nReceipt Number: ${receiptNumber}`);

      if (onUpdate) onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error finalizing receipt:', error);
      alert(`Failed to finalize receipt: ${error.message}`);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!googleDriveUrl) {
      alert('Please generate draft first');
      return;
    }

    const match = googleDriveUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      alert('Could not extract document ID from Google Drive URL');
      return;
    }

    const documentId = match[1];

    try {
      const pdfResponse = await fetch(`https://docs.google.com/document/d/${documentId}/export?format=pdf`);

      if (!pdfResponse.ok) {
        throw new Error('Failed to export PDF from Google Docs');
      }

      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${receiptNumber || 'receipt'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Generate Receipt</h2>
            <p className="text-sm text-slate-600 mt-1">
              Invoice: {invoice.invoice_number} - {clientName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Receipt Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={receiptData.receipt_date}
                  onChange={(e) => setReceiptData({ ...receiptData, receipt_date: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  disabled={!!googleDriveUrl}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={receiptData.amount}
                  onChange={(e) => setReceiptData({ ...receiptData, amount: parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  disabled={!!googleDriveUrl}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={receiptData.payment_method}
                  onChange={(e) => setReceiptData({ ...receiptData, payment_method: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  disabled={!!googleDriveUrl}
                >
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="FPS">FPS</option>
                  <option value="PayMe">PayMe</option>
                  <option value="Alipay">Alipay</option>
                  <option value="WeChat Pay">WeChat Pay</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Reference
                </label>
                <input
                  type="text"
                  value={receiptData.payment_reference}
                  onChange={(e) => setReceiptData({ ...receiptData, payment_reference: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="e.g., Cheque number, transaction ID"
                  disabled={!!googleDriveUrl}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Remarks
              </label>
              <textarea
                value={receiptData.remarks}
                onChange={(e) => setReceiptData({ ...receiptData, remarks: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                rows={3}
                placeholder="Additional notes..."
                disabled={!!googleDriveUrl}
              />
            </div>
          </div>

          {googleDriveUrl && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-slate-900">Draft Receipt (Google Docs)</h3>
                    <p className="text-sm text-slate-600">Receipt Number: {receiptNumber}</p>
                  </div>
                </div>
                <a
                  href={googleDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </a>
              </div>

              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <iframe
                  src={`${googleDriveUrl.replace('/edit', '/preview')}`}
                  className="w-full h-96 border-0"
                  title="Receipt Preview"
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={loading || generatingPDF}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex gap-2">
            {!googleDriveUrl && (
              <button
                onClick={handleGenerateDraft}
                disabled={loading || !receiptData.receipt_date || !receiptData.amount}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {loading ? 'Generating...' : 'Generate Draft'}
              </button>
            )}

            {googleDriveUrl && (
              <>
                <button
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={handleFinalizePDF}
                  disabled={generatingPDF}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {generatingPDF ? 'Finalizing...' : 'Finalize PDF'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
