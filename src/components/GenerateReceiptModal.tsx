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
  onClose: () => void;
  onSuccess: () => void;
}

const RECEIPT_FOLDER_ID = '1C6MJfBIuiABtBPNUXLlav6AGbHn7WhAw';

export function GenerateReceiptModal({ invoice, onClose, onSuccess }: GenerateReceiptModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoiceNumber: invoice.invoice_number,
    receiptDate: new Date().toISOString().split('T')[0],
    paymentDate: invoice.payment_date || new Date().toISOString().split('T')[0],
    paymentAmount: invoice.amount.toString(),
    paymentMethod: invoice.payment_method || 'Bank Transfer',
    paymentMethodRemark: invoice.remark || '',
  });

  async function getGoogleDriveAccessToken() {
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_oauth_credentials')
      .select('*')
      .maybeSingle();

    if (tokenError) {
      console.error('Error fetching Google OAuth credentials:', tokenError);
      throw new Error('Google Drive not connected. Please contact your administrator to authorize Google Drive in Settings > Authorization.');
    }

    if (!tokenData) {
      throw new Error('Google Drive not connected. Please contact your administrator to authorize Google Drive in Settings > Authorization.');
    }

    let accessToken = tokenData.access_token;
    const tokenExpired = tokenData.token_expires_at && new Date(tokenData.token_expires_at) <= new Date();

    console.log('Token check:', {
      hasToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresAt: tokenData.token_expires_at,
      isExpired: tokenExpired
    });

    if (tokenExpired) {
      if (!tokenData.refresh_token) {
        throw new Error('Refresh token not available. Please re-authorize Google Drive in Settings > Authorization.');
      }

      console.log('Attempting to refresh token with client_id:', import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'present' : 'missing');

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error('Token refresh failed:', {
          status: refreshResponse.status,
          statusText: refreshResponse.statusText,
          error: errorText
        });
        throw new Error('Failed to refresh access token. Please re-authorize Google Drive in Settings > Authorization.');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      await supabase
        .from('google_oauth_credentials')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq('id', tokenData.id);
    }

    return accessToken;
  }

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

      const { data: receiptData, error: insertError } = await supabase
        .from('funding_receipt')
        .insert({
          receipt_number: receiptNumber,
          receipt_date: formData.receiptDate,
          invoice_id: invoice.id,
          invoice_number: formData.invoiceNumber,
          project_id: invoice.project_id,
          project_reference: invoice.project_reference,
          payment_date: formData.paymentDate,
          payment_amount: parseFloat(formData.paymentAmount),
          payment_method: formData.paymentMethod,
          payment_method_remark: formData.paymentMethodRemark,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const pdfBlob = await generateReceiptPdf(receiptData);
      const driveUrl = await uploadReceiptToGoogleDrive(pdfBlob, receiptNumber, formData.invoiceNumber);

      await supabase
        .from('funding_receipt')
        .update({ google_drive_url: driveUrl })
        .eq('id', receiptData.id);

      alert('Receipt generated successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error generating receipt:', error);
      alert(`Failed to generate receipt: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function generateReceiptPdf(receipt: any): Promise<Blob> {
    const response = await fetch('/Funding_Receipt_Template.pdf');
    const existingPdfBytes = await response.arrayBuffer();

    const { PDFDocument, PDFName, PDFBool } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    // Note: We rely on the NeedAppearances flag set below to let PDF readers
    // render Chinese characters using their own fonts. This is more reliable
    // than embedding custom fonts which can cause compatibility issues.

    const { data: mappings } = await supabase
      .from('receipt_field_mappings')
      .select('*, tag:receipt_template_tags(*)')
      .eq('is_active', true);

    if (mappings) {
      for (const mapping of mappings) {
        try {
          let value = '';

          if (mapping.source_type === 'receipt') {
            value = receipt[mapping.source_field] || '';
          }

          if (mapping.default_value && !value) {
            value = mapping.default_value;
          }

          if (value && mapping.transform_function) {
            value = applyTransform(value, mapping.transform_function);
          }

          if (mapping.tag?.tag_name) {
            const field = form.getField(mapping.tag.tag_name);
            if (field && 'setText' in field) {
              const textValue = String(value);

              // Set the text directly - PDF readers will handle special characters
              // using their own fonts thanks to the NeedAppearances flag
              try {
                field.setText(textValue);
              } catch (setError) {
                console.warn(`Could not set text for field ${mapping.tag.tag_name}:`, setError);
                // Field will remain empty or keep its default value
              }
            }
          }
        } catch (err) {
          console.error(`Error setting field ${mapping.tag?.tag_name}:`, err);
        }
      }
    }

    // Set the NeedAppearances flag to tell PDF readers to generate appearances
    // This allows readers to use their own fonts that support Chinese characters
    try {
      const acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
      if (acroForm) {
        (acroForm as any).dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
      }
    } catch (error) {
      console.warn('Could not set NeedAppearances flag:', error);
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  function applyTransform(value: any, transform: string): string {
    switch (transform) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'date_format':
        return new Date(value).toLocaleDateString();
      case 'currency':
        return `$${parseFloat(value).toFixed(2)}`;
      default:
        return String(value);
    }
  }

  async function uploadReceiptToGoogleDrive(
    pdfBlob: Blob,
    receiptNumber: string,
    invoiceNumber: string
  ): Promise<string> {
    const accessToken = await getGoogleDriveAccessToken();

    const today = new Date();
    const datePrefix = today.getFullYear().toString() +
                      (today.getMonth() + 1).toString().padStart(2, '0') +
                      today.getDate().toString().padStart(2, '0');

    const invoiceNumWithoutINV = invoiceNumber.replace(/^INV/i, '');
    const fileName = `${datePrefix}_REC${invoiceNumWithoutINV}.pdf`;

    const metadata = {
      name: fileName,
      parents: [RECEIPT_FOLDER_ID],
      mimeType: 'application/pdf',
    };

    const formDataUpload = new FormData();
    formDataUpload.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formDataUpload.append('file', pdfBlob);

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formDataUpload,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload receipt to Google Drive');
    }

    const uploadResult = await uploadResponse.json();
    return `https://drive.google.com/file/d/${uploadResult.id}/view`;
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
