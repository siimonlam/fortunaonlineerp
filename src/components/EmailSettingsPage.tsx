import { useEffect, useState } from 'react';
import { Mail, Save, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SmtpSettings {
  smtp_host: string;
  smtp_port: string;
  smtp_secure: string;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
}

export function EmailSettingsPage() {
  const [settings, setSettings] = useState<SmtpSettings>({
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'true',
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: 'Your Company',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name']);

      if (error) throw error;

      const loadedSettings: Partial<SmtpSettings> = {};
      data?.forEach((row) => {
        loadedSettings[row.key as keyof SmtpSettings] = row.value;
      });

      setSettings(prev => ({ ...prev, ...loadedSettings }));
    } catch (err) {
      console.error('Error loading SMTP settings:', err);
      setMessage({ type: 'error', text: 'Failed to load email settings' });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('system_settings')
        .upsert(updates);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Email settings saved successfully!' });
    } catch (err) {
      console.error('Error saving SMTP settings:', err);
      setMessage({ type: 'error', text: 'Failed to save email settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof SmtpSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Email Settings (SMTP)</h2>
        <p className="text-slate-600">Configure SMTP server settings for sending scheduled emails</p>
      </div>

      {message && (
        <div className={`rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">SMTP Configuration Required</p>
            <p className="text-blue-700">
              Configure your SMTP server credentials below. These settings will be used to send all scheduled emails.
              Common providers:
            </p>
            <ul className="mt-2 space-y-1 text-blue-700 list-disc list-inside">
              <li><strong>Gmail:</strong> smtp.gmail.com (port 587, TLS enabled)</li>
              <li><strong>Outlook:</strong> smtp-mail.outlook.com (port 587, TLS enabled)</li>
              <li><strong>SendGrid:</strong> smtp.sendgrid.net (port 587, TLS enabled)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              SMTP Host <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={settings.smtp_host}
              onChange={(e) => handleChange('smtp_host', e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">SMTP server hostname</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              SMTP Port <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={settings.smtp_port}
              onChange={(e) => handleChange('smtp_port', e.target.value)}
              placeholder="587"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">Usually 587 (TLS) or 465 (SSL)</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Use TLS/SSL
          </label>
          <select
            value={settings.smtp_secure}
            onChange={(e) => handleChange('smtp_secure', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="true">Yes (Recommended)</option>
            <option value="false">No</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Enable encryption for secure connection</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              SMTP Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={settings.smtp_user}
              onChange={(e) => handleChange('smtp_user', e.target.value)}
              placeholder="your-email@gmail.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">Usually your email address</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              SMTP Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={settings.smtp_password}
                onChange={(e) => handleChange('smtp_password', e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">For Gmail, use App Password</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              From Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={settings.smtp_from_email}
              onChange={(e) => handleChange('smtp_from_email', e.target.value)}
              placeholder="noreply@yourcompany.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">Email address to send from</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              From Name
            </label>
            <input
              type="text"
              value={settings.smtp_from_name}
              onChange={(e) => handleChange('smtp_from_name', e.target.value)}
              placeholder="Your Company"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">Sender name displayed in emails</p>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
