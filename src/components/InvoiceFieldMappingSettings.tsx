import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Save, Settings, X } from 'lucide-react';

interface TemplateTag {
  id: string;
  tag_name: string;
  description: string;
  is_active: boolean;
}

interface FieldMapping {
  id: string;
  tag_id: string;
  source_type: 'project' | 'client';
  source_field: string;
  default_value?: string;
  transform_function?: string;
  is_active: boolean;
  tag?: TemplateTag;
}

interface InvoiceFieldMappingSettingsProps {
  onClose: () => void;
}

const PROJECT_FIELDS = [
  { value: 'title', label: 'Project Title' },
  { value: 'company_name', label: 'Company Name' },
  { value: 'company_name_chinese', label: 'Company Name (Chinese)' },
  { value: 'contact_name', label: 'Contact Name' },
  { value: 'contact_number', label: 'Contact Number' },
  { value: 'email', label: 'Email' },
  { value: 'address', label: 'Address' },
  { value: 'project_name', label: 'Project Name' },
  { value: 'project_reference', label: 'Project Reference' },
  { value: 'abbreviation', label: 'Abbreviation' },
  { value: 'invoice_number', label: 'Invoice Number' },
  { value: 'agreement_ref', label: 'Agreement Reference' },
  { value: 'application_number', label: 'Application Number' },
  { value: 'deposit_amount', label: 'Deposit Amount' },
  { value: 'service_fee_percentage', label: 'Service Fee %' },
  { value: 'project_size', label: 'Project Size' },
  { value: 'start_date', label: 'Start Date' },
  { value: 'project_start_date', label: 'Project Start Date' },
  { value: 'project_end_date', label: 'Project End Date' },
  { value: 'submission_date', label: 'Submission Date' },
  { value: 'approval_date', label: 'Approval Date' },
  { value: 'next_due_date', label: 'Next Due Date' },
  { value: 'next_hkpc_due_date', label: 'Next HKPC Due Date' },
];

const CLIENT_FIELDS = [
  { value: 'company_name', label: 'Client Company Name' },
  { value: 'client_number', label: 'Client Number' },
  { value: 'industry', label: 'Industry' },
  { value: 'abbreviation', label: 'Client Abbreviation' },
];

const TRANSFORM_FUNCTIONS = [
  { value: '', label: 'None' },
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'lowercase', label: 'Lowercase' },
  { value: 'date_format', label: 'Date Format' },
  { value: 'currency', label: 'Currency Format' },
];

export function InvoiceFieldMappingSettings({ onClose }: InvoiceFieldMappingSettingsProps) {
  const [tags, setTags] = useState<TemplateTag[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState({ tag_name: '', description: '' });
  const [showAddTag, setShowAddTag] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [tagsRes, mappingsRes] = await Promise.all([
        supabase.from('invoice_template_tags').select('*').order('tag_name'),
        supabase
          .from('invoice_field_mappings')
          .select('*, tag:invoice_template_tags(*)')
          .order('created_at'),
      ]);

      if (tagsRes.data) setTags(tagsRes.data);
      if (mappingsRes.data) setMappings(mappingsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load mapping settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTag() {
    if (!newTag.tag_name.trim()) {
      alert('Please enter a tag name');
      return;
    }

    if (!newTag.tag_name.startsWith('<') || !newTag.tag_name.endsWith('>')) {
      alert('Tag name must be in format: <tag_name>');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('invoice_template_tags')
        .insert({
          tag_name: newTag.tag_name,
          description: newTag.description,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setTags([...tags, data]);
      setNewTag({ tag_name: '', description: '' });
      setShowAddTag(false);
    } catch (error: any) {
      console.error('Error adding tag:', error);
      alert(`Failed to add tag: ${error.message}`);
    }
  }

  async function handleAddMapping(tagId: string) {
    const newMapping = {
      tag_id: tagId,
      source_type: 'project' as const,
      source_field: 'company_name',
      is_active: true,
    };

    try {
      const { data, error } = await supabase
        .from('invoice_field_mappings')
        .insert(newMapping)
        .select('*, tag:invoice_template_tags(*)')
        .single();

      if (error) throw error;

      setMappings([...mappings, data]);
    } catch (error: any) {
      console.error('Error adding mapping:', error);
      alert(`Failed to add mapping: ${error.message}`);
    }
  }

  async function handleUpdateMapping(mappingId: string, field: string, value: any) {
    try {
      const { error } = await supabase
        .from('invoice_field_mappings')
        .update({ [field]: value })
        .eq('id', mappingId);

      if (error) throw error;

      setMappings(
        mappings.map((m) => (m.id === mappingId ? { ...m, [field]: value } : m))
      );
    } catch (error: any) {
      console.error('Error updating mapping:', error);
      alert(`Failed to update mapping: ${error.message}`);
    }
  }

  async function handleDeleteMapping(mappingId: string) {
    if (!confirm('Delete this mapping?')) return;

    try {
      const { error } = await supabase
        .from('invoice_field_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;

      setMappings(mappings.filter((m) => m.id !== mappingId));
    } catch (error: any) {
      console.error('Error deleting mapping:', error);
      alert(`Failed to delete mapping: ${error.message}`);
    }
  }

  async function handleDeleteTag(tagId: string) {
    if (!confirm('Delete this tag and all its mappings?')) return;

    try {
      const { error } = await supabase
        .from('invoice_template_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;

      setTags(tags.filter((t) => t.id !== tagId));
      setMappings(mappings.filter((m) => m.tag_id !== tagId));
    } catch (error: any) {
      console.error('Error deleting tag:', error);
      alert(`Failed to delete tag: ${error.message}`);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-800">Invoice Field Mapping Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>1. Add template tags (like <code className="bg-blue-100 px-1 rounded">&lt;Company Name&gt;</code>) that exist in your Word template</li>
                <li>2. Map each tag to a field from the project or client data</li>
                <li>3. When generating invoices, tags will be replaced with actual values</li>
              </ul>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">Template Tags</h3>
              <button
                onClick={() => setShowAddTag(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Tag
              </button>
            </div>

            {showAddTag && (
              <div className="border border-slate-300 rounded-lg p-4 bg-slate-50">
                <h4 className="font-medium text-slate-800 mb-3">Add New Tag</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tag Name (e.g., &lt;invoice_no&gt;)
                    </label>
                    <input
                      type="text"
                      value={newTag.tag_name}
                      onChange={(e) => setNewTag({ ...newTag, tag_name: e.target.value })}
                      placeholder="<tag_name>"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newTag.description}
                      onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                      placeholder="Description"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTag(false);
                      setNewTag({ tag_name: '', description: '' });
                    }}
                    className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {tags.map((tag) => {
                const tagMappings = mappings.filter((m) => m.tag_id === tag.id);

                return (
                  <div key={tag.id} className="border border-slate-300 rounded-lg p-4 bg-white">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-semibold text-slate-800 text-lg">
                          {tag.tag_name}
                        </h4>
                        <p className="text-sm text-slate-600">{tag.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddMapping(tag.id)}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Mapping
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {tagMappings.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">No mappings configured</p>
                    ) : (
                      <div className="space-y-3">
                        {tagMappings.map((mapping) => (
                          <div
                            key={mapping.id}
                            className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded"
                          >
                            <div className="col-span-3">
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Source Type
                              </label>
                              <select
                                value={mapping.source_type}
                                onChange={(e) =>
                                  handleUpdateMapping(mapping.id, 'source_type', e.target.value)
                                }
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                              >
                                <option value="project">Project</option>
                                <option value="client">Client</option>
                              </select>
                            </div>
                            <div className="col-span-3">
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Field
                              </label>
                              <select
                                value={mapping.source_field}
                                onChange={(e) =>
                                  handleUpdateMapping(mapping.id, 'source_field', e.target.value)
                                }
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                              >
                                {mapping.source_type === 'project'
                                  ? PROJECT_FIELDS.map((f) => (
                                      <option key={f.value} value={f.value}>
                                        {f.label}
                                      </option>
                                    ))
                                  : CLIENT_FIELDS.map((f) => (
                                      <option key={f.value} value={f.value}>
                                        {f.label}
                                      </option>
                                    ))}
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Transform
                              </label>
                              <select
                                value={mapping.transform_function || ''}
                                onChange={(e) =>
                                  handleUpdateMapping(
                                    mapping.id,
                                    'transform_function',
                                    e.target.value || null
                                  )
                                }
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                              >
                                {TRANSFORM_FUNCTIONS.map((f) => (
                                  <option key={f.value} value={f.value}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-3">
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Default Value
                              </label>
                              <input
                                type="text"
                                value={mapping.default_value || ''}
                                onChange={(e) =>
                                  handleUpdateMapping(
                                    mapping.id,
                                    'default_value',
                                    e.target.value
                                  )
                                }
                                placeholder="Optional"
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button
                                onClick={() => handleDeleteMapping(mapping.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {tags.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <p>No template tags configured yet.</p>
                <p className="text-sm">Click "Add Tag" to create your first mapping.</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 p-4 bg-slate-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
