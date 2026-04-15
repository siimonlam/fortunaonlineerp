import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { MetaMessengerPage } from '../types/messenger';
import {
  Plus, Trash2, Settings, CheckCircle, XCircle, RefreshCw,
  ExternalLink, AlertCircle, Eye, EyeOff, Info, ChevronLeft,
  Globe, MessageCircle
} from 'lucide-react';

interface Props {
  onBack: () => void;
}

export function MetaMessengerSettingsPage({ onBack }: Props) {
  const [pages, setPages] = useState<MetaMessengerPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ page_id: '', page_name: '', access_token: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, 'ok' | 'error'>>({});
  const [webhookUrl, setWebhookUrl] = useState('');
  const [verifyToken] = useState('meta_messenger_verify_token');

  useEffect(() => {
    loadPages();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-messenger-webhook`;
    setWebhookUrl(url);
  }, []);

  const loadPages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('meta_messenger_pages')
      .select('*')
      .order('page_name');
    setPages(data || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!formData.page_id.trim() || !formData.page_name.trim() || !formData.access_token.trim()) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: err } = await supabase.from('meta_messenger_pages').insert({
      page_id: formData.page_id.trim(),
      page_name: formData.page_name.trim(),
      access_token: formData.access_token.trim(),
      is_active: true,
    });

    if (err) {
      setError(err.message.includes('duplicate') ? 'This Page ID is already connected.' : err.message);
    } else {
      setSuccess('Facebook Page connected successfully!');
      setFormData({ page_id: '', page_name: '', access_token: '' });
      setShowAddForm(false);
      await loadPages();
    }
    setSaving(false);
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this Facebook Page? Existing messages will be kept.')) return;
    setDeletingId(id);
    await supabase.from('meta_messenger_pages').delete().eq('id', id);
    await loadPages();
    setDeletingId(null);
  };

  const handleToggleActive = async (page: MetaMessengerPage) => {
    await supabase.from('meta_messenger_pages').update({ is_active: !page.is_active }).eq('id', page.id);
    await loadPages();
  };

  const handleVerifyToken = async (page: MetaMessengerPage) => {
    setVerifyingId(page.id);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${page.page_id}?fields=name,id&access_token=${page.access_token}`
      );
      if (res.ok) {
        setVerifyResults(prev => ({ ...prev, [page.id]: 'ok' }));
      } else {
        setVerifyResults(prev => ({ ...prev, [page.id]: 'error' }));
      }
    } catch {
      setVerifyResults(prev => ({ ...prev, [page.id]: 'error' }));
    }
    setVerifyingId(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-800">Messenger Settings</h1>
              <p className="text-xs text-slate-500">Manage connected Facebook Pages</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full">
        {success && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        {/* Webhook setup instructions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm mb-1">Setup Instructions</h3>
              <p className="text-xs text-slate-500">Configure your Facebook App to receive messages from Messenger.</p>
            </div>
          </div>

          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
              <span>Go to your <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Facebook App Dashboard <ExternalLink className="w-3 h-3" /></a></span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
              <span>Go to <strong>Messenger → Settings → Webhooks</strong> and click <strong>Add Callback URL</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
              <div className="flex-1">
                <p className="mb-1.5">Set the <strong>Callback URL</strong> to:</p>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <code className="text-xs text-slate-700 flex-1 break-all">{webhookUrl}</code>
                  <button
                    onClick={() => copyToClipboard(webhookUrl)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">4</span>
              <div className="flex-1">
                <p className="mb-1.5">Set the <strong>Verify Token</strong> to:</p>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <code className="text-xs text-slate-700 flex-1">{verifyToken}</code>
                  <button
                    onClick={() => copyToClipboard(verifyToken)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">5</span>
              <span>Subscribe to <strong>messages</strong> and <strong>messaging_postbacks</strong> events</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">6</span>
              <span>Subscribe the webhook to each Facebook Page below using a Page Access Token</span>
            </li>
          </ol>
        </div>

        {/* Connected pages */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-slate-800 text-sm">Connected Pages</h3>
              {pages.length > 0 && (
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  {pages.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Page
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-6 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500 mb-1">No pages connected yet</p>
              <p className="text-xs text-slate-400">Add a Facebook Page to start receiving Messenger messages</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pages.map(page => (
                <div key={page.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">{page.page_name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-slate-800 text-sm">{page.page_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          page.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {page.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {verifyResults[page.id] && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                            verifyResults[page.id] === 'ok'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {verifyResults[page.id] === 'ok' ? (
                              <><CheckCircle className="w-3 h-3" />Token valid</>
                            ) : (
                              <><XCircle className="w-3 h-3" />Token invalid</>
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mb-2">Page ID: {page.page_id}</p>

                      {/* Token field */}
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mb-2">
                        <code className="text-xs text-slate-500 flex-1 overflow-hidden">
                          {showToken[page.id]
                            ? page.access_token
                            : '•'.repeat(Math.min(page.access_token.length, 40))}
                        </code>
                        <button
                          onClick={() => setShowToken(prev => ({ ...prev, [page.id]: !prev[page.id] }))}
                          className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                        >
                          {showToken[page.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleToggleActive(page)}
                          className="text-xs text-slate-500 hover:text-slate-700 underline"
                        >
                          {page.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <span className="text-slate-200">·</span>
                        <button
                          onClick={() => handleVerifyToken(page)}
                          disabled={verifyingId === page.id}
                          className="text-xs text-blue-600 hover:text-blue-700 underline disabled:opacity-50 flex items-center gap-1"
                        >
                          {verifyingId === page.id && <RefreshCw className="w-3 h-3 animate-spin" />}
                          Verify token
                        </button>
                        <span className="text-slate-200">·</span>
                        <button
                          onClick={() => handleDelete(page.id)}
                          disabled={deletingId === page.id}
                          className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50 flex items-center gap-1"
                        >
                          {deletingId === page.id && <RefreshCw className="w-3 h-3 animate-spin" />}
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleDelete(page.id)}
                        disabled={deletingId === page.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Remove page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add page form */}
        {showAddForm && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-sm">Connect a Facebook Page</h3>
              <button
                onClick={() => { setShowAddForm(false); setError(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Page Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Business Page"
                  value={formData.page_name}
                  onChange={e => setFormData(prev => ({ ...prev, page_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Page ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123456789012345"
                  value={formData.page_id}
                  onChange={e => setFormData(prev => ({ ...prev, page_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Found in your Facebook Page → About → Page transparency</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Page Access Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  placeholder="EAAg..."
                  value={formData.access_token}
                  onChange={e => setFormData(prev => ({ ...prev, access_token: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Get from <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Graph API Explorer</a> with <code>pages_messaging</code> permission
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Connect Page
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setError(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
