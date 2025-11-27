import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Eye, Save } from 'lucide-react';
import { generateInvoiceFromTemplate } from '../utils/invoiceTemplateUtils';
import { InvoicePreview } from './InvoicePreview';

interface CreateInvoiceModalProps {
  project: any;
  onClose: () => void;
  onSuccess: () => void;
}

const INVOICE_FOLDER_ID = '1-D6RXiVc7bi3qYT__fLxRqh7MDJ1_Hyz';

export function CreateInvoiceModal({ project, onClose, onSuccess }: CreateInvoiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentStatus: 'Pending',
    amount: project.deposit_amount?.toString() || '',
    paymentMethod: '',
    paymentType: 'Deposit',
  });

  useEffect(() => {
    async function generateInvoiceNumber() {
      if (!project.client_id) return;

      try {
        const { data, error } = await supabase.rpc('generate_invoice_number', {
          client_uuid: project.client_id
        });

        if (error) throw error;

        if (data) {
          setFormData(prev => ({ ...prev, invoiceNumber: data }));
        }
      } catch (error) {
        console.error('Error generating invoice number:', error);
      }
    }

    generateInvoiceNumber();
  }, [project.client_id]);

  async function getGoogleDriveAccessToken() {
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_oauth_credentials')
      .select('*')
      .eq('service_name', 'google_drive')
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error('Google Drive not connected. Please contact your administrator to authorize Google Drive in Settings > Authorization.');
    }

    let accessToken = tokenData.access_token;

    if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) <= new Date()) {
      if (!tokenData.refresh_token) {
        throw new Error('Google Drive token expired. Please contact your administrator to re-authorize in Settings > Authorization.');
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID,
          client_secret: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh Google Drive token. Please contact your administrator to re-authorize in Settings > Authorization.');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      await supabase
        .from('google_oauth_credentials')
        .update({
          access_token: refreshData.access_token,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tokenData.id);
    }

    return accessToken;
  }

  async function handlePreview() {
    setLoading(true);
    try {
      const templateResponse = await fetch('/Funding_Invoice_Template.pdf');
      if (!templateResponse.ok) {
        throw new Error('Failed to load invoice template');
      }

      const templateArrayBuffer = await templateResponse.arrayBuffer();

      const pdfBlob = await generateInvoiceFromTemplate(project.id, templateArrayBuffer);

      setPdfBlob(pdfBlob);
      setShowPreview(true);
    } catch (error: any) {
      console.error('Error generating preview:', error);
      alert(`Failed to generate preview: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!pdfBlob) {
      alert('Please generate preview first');
      return;
    }

    if (!formData.invoiceNumber || !formData.amount) {
      alert('Invoice number and amount are required');
      return;
    }

    setLoading(true);
    try {
      const accessToken = await getGoogleDriveAccessToken();

      const today = new Date();
      const datePrefix = today.getFullYear().toString() +
                        (today.getMonth() + 1).toString().padStart(2, '0') +
                        today.getDate().toString().padStart(2, '0');
      const fileName = `${datePrefix}_${formData.invoiceNumber}_${project.company_name || 'Invoice'}.pdf`;

      const metadata = {
        name: fileName,
        parents: [INVOICE_FOLDER_ID],
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
        throw new Error('Failed to upload to Google Drive');
      }

      const result = await uploadResponse.json();
      const driveFileUrl = `https://drive.google.com/file/d/${result.id}/view`;

      const { error: dbError } = await supabase
        .from('funding_invoice')
        .insert({
          project_id: project.id,
          client_id: project.client_id,
          invoice_number: formData.invoiceNumber,
          issue_date: formData.issueDate || null,
          due_date: formData.dueDate || null,
          payment_status: formData.paymentStatus,
          amount: parseFloat(formData.amount),
          project_reference: project.project_reference || null,
          company_name: project.company_name || null,
          payment_method: formData.paymentMethod || null,
          payment_type: formData.paymentType,
          google_drive_url: driveFileUrl,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (dbError) throw dbError;

      alert('Invoice created and saved to Google Drive successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      alert(`Failed to save invoice: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (showPreview && pdfBlob) {
    return (
      <InvoicePreview
        pdfBlob={pdfBlob}
        onClose={() => {
          setShowPreview(false);
          setPdfBlob(null);
        }}
        onSave={handleSave}
        loading={loading}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">Create Invoice</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Invoice Number *
                </label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount (HKD) *
                </label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Issue Date
                </label>
                <input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Due Date
                </label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={formData.paymentStatus}
                  onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Void">Void</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Type
                </label>
                <select
                  value={formData.paymentType}
                  onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Deposit">Deposit</option>
                  <option value="2nd Payment">2nd Payment</option>
                  <option value="3rd Payment">3rd Payment</option>
                  <option value="Final Payment">Final Payment</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Method
              </label>
              <input
                type="text"
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Bank Transfer, Cheque, etc."
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Project:</strong> {project.company_name || 'N/A'}
                <br />
                <strong>Reference:</strong> {project.project_reference || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePreview}
            disabled={loading || !formData.invoiceNumber || !formData.amount}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye className="w-4 h-4" />
            {loading ? 'Generating...' : 'Preview & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
