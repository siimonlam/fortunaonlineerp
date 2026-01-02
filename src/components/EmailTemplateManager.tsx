import { useState, useEffect } from 'react';
import { Mail, Plus, Edit2, Trash2, X, Save, AlertCircle, CheckCircle, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface EmailTemplate {
  id: string;
  user_id: string;
  template_name: string;
  subject: string;
  body: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export function EmailTemplateManager() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    template_name: '',
    subject: '',
    body: '',
    is_shared: false,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('template_name', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      console.error('Error loading templates:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load templates' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      template_name: '',
      subject: '',
      body: '',
      is_shared: false,
    });
    setEditingTemplate(null);
    setShowModal(false);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      subject: template.subject,
      body: template.body,
      is_shared: template.is_shared,
    });
    setShowModal(true);
  };

  const saveTemplate = async () => {
    if (!formData.template_name.trim() || !formData.subject.trim() || !formData.body.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update({
            template_name: formData.template_name,
            subject: formData.subject,
            body: formData.body,
            is_shared: formData.is_shared,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Template updated successfully!' });
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert({
            user_id: user?.id,
            template_name: formData.template_name,
            subject: formData.subject,
            body: formData.body,
            is_shared: formData.is_shared,
            created_by: user?.id,
          });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Template created successfully!' });
      }

      resetForm();
      loadTemplates();
    } catch (err: any) {
      console.error('Error saving template:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save template' });
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Template deleted successfully!' });
      loadTemplates();
    } catch (err: any) {
      console.error('Error deleting template:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to delete template' });
    }
  };

  const canEdit = (template: EmailTemplate) => template.user_id === user?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Email Templates</h2>
          <p className="text-slate-600">Create and manage email templates with variables</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Template
        </button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Available Variables:</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-blue-800">
          <code className="bg-white px-2 py-1 rounded">{'{{project_name}}'}</code>
          <code className="bg-white px-2 py-1 rounded">{'{{client_name}}'}</code>
          <code className="bg-white px-2 py-1 rounded">{'{{client_contact}}'}</code>
          <code className="bg-white px-2 py-1 rounded">{'{{user_name}}'}</code>
          <code className="bg-white px-2 py-1 rounded">{'{{today}}'}</code>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 text-lg mb-2">No templates yet</p>
          <p className="text-slate-500 text-sm">Create your first email template to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {templates.map(template => (
            <div key={template.id} className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-slate-900">{template.template_name}</h3>
                    {template.is_shared && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        <Share2 className="w-3 h-3" />
                        Shared
                      </span>
                    )}
                    {!canEdit(template) && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                        View Only
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500">Subject:</span>{' '}
                      <span className="text-slate-700 font-medium">{template.subject}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Body Preview:</span>{' '}
                      <span className="text-slate-700">{template.body.substring(0, 150)}...</span>
                    </div>
                  </div>
                </div>
                {canEdit(template) && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(template)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit template"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h3>
              <button
                onClick={resetForm}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Project Follow-up"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Update on {{project_name}}"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Body *
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Dear {{client_contact}},&#10;&#10;This is regarding {{project_name}}...&#10;&#10;Best regards,&#10;{{user_name}}"
                  required
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_shared}
                  onChange={(e) => setFormData({ ...formData, is_shared: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Share this template with all users</span>
              </label>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTemplate}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {editingTemplate ? 'Update' : 'Create'} Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
