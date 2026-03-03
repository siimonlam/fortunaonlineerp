import { useState, useEffect } from 'react';
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
  const [clientData, setClientData] = useState<any>(null);
  const [receiptData, setReceiptData] = useState({
    receipt_date: invoice.payment_date || new Date().toISOString().split('T')[0],
    amount: invoice.amount,
    payment_method: invoice.payment_method || 'Cash',
    payment_reference: '',
    remarks: ''
  });
  const [googleDriveUrl, setGoogleDriveUrl] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);

  useEffect(() => {
    const generatedReceiptNumber = 'R' + invoice.invoice_number.substring(1);
    setReceiptNumber(generatedReceiptNumber);
    loadClientData();
  }, [invoice.invoice_number, invoice.comsec_client_id]);

  const loadClientData = async () => {
    try {
      const { data, error } = await supabase
        .from('comsec_clients')
        .select('company_name, company_name_chinese, address, company_code, contact_person, phone')
        .eq('id', invoice.comsec_client_id)
        .single();

      if (error) throw error;
      setClientData(data);
    } catch (error) {
      console.error('Error loading client data:', error);
    }
  };

  const handleGenerateDraft = async () => {
    setLoading(true);
    try {
      if (!clientData) {
        throw new Error('Client data not loaded');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-comsec-receipt-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiptNumber: receiptNumber!,
          clientName: clientData?.company_name_chinese || clientData?.company_name || clientName,
          clientAddress: clientData?.address || '',
          clientContact: clientData?.contact_person || '',
          clientPhone: clientData?.phone || '',
          amount: receiptData.amount,
          receiptDate: receiptData.receipt_date,
          paymentMethod: receiptData.payment_method,
          paymentReference: receiptData.payment_reference,
          remarks: receiptData.remarks,
          invoiceNumber: invoice.invoice_number,
          companyCode: clientData?.company_code || '',
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

      const pdfResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-drive-file?fileId=${documentId}&format=pdf`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        throw new Error(`Failed to export PDF: ${errorText}`);
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
      const pdfResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-drive-file?fileId=${documentId}&format=pdf`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        throw new Error(`Failed to export PDF: ${errorText}`);
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
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      alert(`Failed to download PDF: ${error.message}`);
    }
  };

  const hasDraftWithGoogleDocs = googleDriveUrl;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl ${hasDraftWithGoogleDocs ? 'max-w-7xl' : 'max-w-4xl'} w-full max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Generate Receipt</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Invoice: {invoice.invoice_number} - {clientName}
            </p>
            {receiptNumber && (
              <p className="text-sm font-semibold text-blue-600 mt-1">
                Receipt Number: {receiptNumber}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className={`${hasDraftWithGoogleDocs ? 'grid grid-cols-2 gap-6' : ''}`}>
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Receipt Details</h3>

                {clientData && (
                  <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200">
                    <div className="text-sm font-medium text-slate-700 mb-2">Client Information</div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <div><span className="font-medium">Company:</span> {clientData.company_name_chinese || clientData.company_name}</div>
                      {clientData.company_code && <div><span className="font-medium">Code:</span> {clientData.company_code}</div>}
                      {clientData.contact_person && <div><span className="font-medium">Contact:</span> {clientData.contact_person}</div>}
                      {clientData.phone && <div><span className="font-medium">Phone:</span> {clientData.phone}</div>}
                      {clientData.address && <div><span className="font-medium">Address:</span> {clientData.address}</div>}
                    </div>
                  </div>
                )}

                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 mb-2">Template Placeholders</div>
                  <div className="text-xs text-blue-800 space-y-1">
                    <div>Use these placeholders in your Google Doc template:</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 font-mono">
                      <div>{'{RECEIPT_NUMBER}'} - Receipt number</div>
                      <div>{'{RECEIPT_DATE}'} - Receipt date</div>
                      <div>{'{CLIENT_NAME}'} - Client name</div>
                      <div>{'{CLIENT_ADDRESS}'} - Client address</div>
                      <div>{'{CLIENT_CONTACT}'} - Contact person</div>
                      <div>{'{CLIENT_PHONE}'} - Phone number</div>
                      <div>{'{COMPANY_CODE}'} - Company code</div>
                      <div>{'{AMOUNT}'} - Receipt amount</div>
                      <div>{'{PAYMENT_METHOD}'} - Payment method</div>
                      <div>{'{PAYMENT_REFERENCE}'} - Payment ref</div>
                      <div>{'{INVOICE_NUMBER}'} - Related invoice</div>
                      <div>{'{REMARKS}'} - Additional notes</div>
                    </div>
                  </div>
                </div>

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

                <div className="mt-4">
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
            </div>

            {googleDriveUrl && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-blue-900">Draft Receipt (Google Docs)</div>
                        <div className="text-sm text-blue-700">Review before finalizing</div>
                      </div>
                    </div>
                    <a
                      href={googleDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in New Tab
                    </a>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white" style={{ height: '600px' }}>
                  <iframe
                    src={googleDriveUrl.replace('/edit', '/edit?embedded=true')}
                    className="w-full h-full"
                    title="Receipt Editor"
                    style={{ border: 'none' }}
                  />
                </div>
              </div>
            )}
          </div>
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
