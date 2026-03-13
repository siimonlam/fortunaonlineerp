import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, ExternalLink, CheckCircle, AlertCircle, FileText, Info } from 'lucide-react';

export function FundingInvoiceSettingsPanel() {
  const [templateDocId, setTemplateDocId] = useState('');
  const [templateDocUrl, setTemplateDocUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'funding_invoice_template_doc_id')
      .maybeSingle();

    if (data?.value) {
      setTemplateDocId(data.value);
      setTemplateDocUrl(`https://docs.google.com/document/d/${data.value}/edit`);
    }
  }

  function parseDocId(input: string): string {
    const urlMatch = input.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) return urlMatch[1];
    return input.trim();
  }

  function handleInputChange(value: string) {
    const docId = parseDocId(value);
    setTemplateDocId(docId);
    if (docId) {
      setTemplateDocUrl(`https://docs.google.com/document/d/${docId}/edit`);
    } else {
      setTemplateDocUrl('');
    }
    setSaveStatus('idle');
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus('idle');
    setSaveMessage('');

    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: templateDocId })
        .eq('key', 'funding_invoice_template_doc_id');

      if (error) throw error;

      setSaveStatus('success');
      setSaveMessage('Template settings saved successfully');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-slate-600" />
          Invoice Settings
        </h3>
        <p className="text-sm text-slate-500">Configure the Google Doc template used when generating funding invoices.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-slate-700">Google Doc Invoice Template</span>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Template Document ID or URL
            </label>
            <input
              type="text"
              value={templateDocId}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Paste Google Doc URL or document ID"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              You can paste the full Google Doc URL or just the document ID from the URL.
            </p>
          </div>

          {templateDocUrl && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-700 mb-0.5">Current Template</p>
                <p className="text-xs text-blue-600 truncate font-mono">{templateDocId}</p>
              </div>
              <a
                href={templateDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-600 border border-blue-300 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors flex-shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !templateDocId}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>

          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {saveMessage}
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {saveMessage}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Available Template Placeholders</span>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500 mb-3">
            Add these placeholders to your Google Doc template. They will be replaced with actual data when an invoice is generated.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { placeholder: '{{INVOICE_NUMBER}}', description: 'Invoice number' },
              { placeholder: '{{ISSUE_DATE}}', description: 'Invoice issue date (DD/MM/YYYY)' },
              { placeholder: '{{DUE_DATE}}', description: 'Payment due date (DD/MM/YYYY)' },
              { placeholder: '{{AMOUNT}}', description: 'Invoice amount (e.g. HK$10,000.00)' },
              { placeholder: '{{PAYMENT_TYPE}}', description: 'Deposit / 2nd Payment / Final Payment' },
              { placeholder: '{{COMPANY_NAME}}', description: 'Client company name (English)' },
              { placeholder: '{{COMPANY_NAME_CHINESE}}', description: 'Client company name (Chinese)' },
              { placeholder: '{{CONTACT_NAME}}', description: 'Contact person name' },
              { placeholder: '{{CONTACT_NUMBER}}', description: 'Contact phone number' },
              { placeholder: '{{ADDRESS}}', description: 'Client address' },
              { placeholder: '{{PROJECT_TITLE}}', description: 'Full project title' },
              { placeholder: '{{PROJECT_REFERENCE}}', description: 'Project reference number' },
              { placeholder: '{{APPLICATION_NUMBER}}', description: 'Funding application number' },
              { placeholder: '{{FUNDING_SCHEME}}', description: 'Funding scheme name' },
              { placeholder: '{{CLIENT_NUMBER}}', description: 'Client number (e.g. C001)' },
              { placeholder: '{{ISSUED_COMPANY}}', description: 'Issuing company name' },
              { placeholder: '{{CATEGORY}}', description: 'Invoice category (BUD, TVP, etc.)' },
              { placeholder: '{{REMARK}}', description: 'Additional remarks / notes' },
            ].map(({ placeholder, description }) => (
              <div key={placeholder} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50">
                <code className="text-xs bg-slate-100 text-blue-700 px-2 py-0.5 rounded font-mono flex-shrink-0">
                  {placeholder}
                </code>
                <span className="text-xs text-slate-500 pt-0.5">{description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
