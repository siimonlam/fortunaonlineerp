import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Power, Calendar, CheckSquare, Tag, Zap, Edit2 } from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  project_type_id: string;
  main_status: string;
  trigger_type: 'hkpc_date_set' | 'task_completed' | 'status_changed' | 'periodic' | 'days_after_date' | 'deposit_paid' | 'application_number_set' | 'approval_date_set' | 'label_added';
  trigger_config: any;
  condition_type?: 'no_condition' | 'sales_source' | 'sales_person';
  condition_config?: any;
  action_type: 'add_task' | 'add_label' | 'remove_label' | 'change_status' | 'set_field_value';
  action_config: any;
  execution_frequency_days?: number;
  is_active: boolean;
  created_at: string;
}

interface ProjectType {
  id: string;
  name: string;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface Staff {
  id: string;
  email: string;
  full_name: string;
}

interface Status {
  id: string;
  name: string;
  project_type_id: string;
  is_substatus?: boolean;
  order_index: number;
  parent_status_id?: string;
}

const MAIN_STATUSES = ['Hi-Po', 'Pre-Submission', 'Q&A', 'Final Report'];

const TRIGGER_TYPES = [
  { value: 'hkpc_date_set', label: 'New Next HKPC Date is set' },
  { value: 'task_completed', label: 'A Project task is completed' },
  { value: 'status_changed', label: 'Project converts to a new status' },
  { value: 'deposit_paid', label: 'Deposit status is paid' },
  { value: 'periodic', label: 'Periodically Action' },
  { value: 'days_after_date', label: 'X days after a date field' },
  { value: 'application_number_set', label: 'Application number is set' },
  { value: 'approval_date_set', label: 'Approval Date is set' },
  { value: 'label_added', label: 'A label is added' }
];

const ACTION_TYPES = [
  { value: 'add_task', label: 'Add a task' },
  { value: 'add_label', label: 'Add a label' },
  { value: 'remove_label', label: 'Remove a label' },
  { value: 'change_status', label: 'Change project status' },
  { value: 'set_field_value', label: 'Set field value' }
];

const CONDITION_TYPES = [
  { value: 'no_condition', label: 'No Condition' },
  { value: 'sales_source', label: 'Sales Source' },
  { value: 'sales_person', label: 'Sales Person' }
];

interface AutomationPageProps {
  projectTypeId?: string;
  projectTypeName?: string;
}

export function AutomationPage({ projectTypeId, projectTypeName = 'Funding Project' }: AutomationPageProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    project_type_id: projectTypeId || '',
    main_status: '',
    trigger_type: 'hkpc_date_set' as AutomationRule['trigger_type'],
    trigger_config: {},
    condition_type: 'no_condition' as AutomationRule['condition_type'],
    condition_config: {},
    action_type: 'add_task' as AutomationRule['action_type'],
    action_config: {
      due_date_base: '',
      due_date_offset: 0,
      due_date_direction: 'after',
      status_id: ''
    },
    execution_frequency_days: 1
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    let rulesQuery = supabase.from('automation_rules').select('*').order('created_at', { ascending: false });

    if (projectTypeId) {
      rulesQuery = rulesQuery.eq('project_type_id', projectTypeId);
    }

    const fundingProjectType = await supabase
      .from('project_types')
      .select('id')
      .eq('name', 'Funding Project')
      .maybeSingle();

    const [rulesRes, typesRes, labelsRes, staffRes, statusesRes] = await Promise.all([
      rulesQuery,
      supabase.from('project_types').select('id, name'),
      supabase.from('labels').select('*').order('order_index'),
      supabase.from('staff').select('id, email, full_name'),
      fundingProjectType.data
        ? supabase.from('statuses').select('id, name, project_type_id, is_substatus, order_index, parent_status_id').eq('project_type_id', fundingProjectType.data.id)
        : supabase.from('statuses').select('id, name, project_type_id, is_substatus, order_index, parent_status_id')
    ]);

    if (rulesRes.data) setRules(rulesRes.data);
    if (typesRes.data) setProjectTypes(typesRes.data);
    if (labelsRes.data) setLabels(labelsRes.data);
    if (staffRes.data) setStaff(staffRes.data);
    if (statusesRes.data) setStatuses(statusesRes.data);
  }

  async function toggleRuleActive(ruleId: string, isActive: boolean) {
    const { error } = await supabase
      .from('automation_rules')
      .update({ is_active: !isActive, updated_at: new Date().toISOString() })
      .eq('id', ruleId);

    if (error) {
      alert('Error updating rule: ' + error.message);
    } else {
      await loadData();
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;

    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      alert('Error deleting rule: ' + error.message);
    } else {
      await loadData();
    }
  }

  async function saveRule() {
    if (!formData.name || !formData.main_status) {
      alert('Please fill in the rule name and status');
      return;
    }

    setLoading(true);

    const ruleData = {
      name: formData.name,
      project_type_id: formData.project_type_id || null,
      main_status: formData.main_status,
      trigger_type: formData.trigger_type,
      trigger_config: formData.trigger_config,
      condition_type: formData.condition_type || 'no_condition',
      condition_config: formData.condition_config || {},
      action_type: formData.action_type,
      action_config: formData.action_config,
      execution_frequency_days: formData.execution_frequency_days || 1,
      updated_at: new Date().toISOString()
    };

    const { error } = editingRule
      ? await supabase.from('automation_rules').update(ruleData).eq('id', editingRule.id)
      : await supabase.from('automation_rules').insert(ruleData);

    if (error) {
      alert(`Error ${editingRule ? 'updating' : 'creating'} rule: ` + error.message);
    } else {
      setShowNewRuleForm(false);
      setEditingRule(null);
      setFormData({
        name: '',
        project_type_id: projectTypeId || '',
        main_status: '',
        trigger_type: 'hkpc_date_set',
        trigger_config: {},
        condition_type: 'no_condition',
        condition_config: {},
        action_type: 'add_task',
        action_config: {
          due_date_base: '',
          due_date_offset: 0,
          due_date_direction: 'after'
        },
        execution_frequency_days: 1
      });
      await loadData();
    }

    setLoading(false);
  }

  function editRule(rule: AutomationRule) {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      project_type_id: rule.project_type_id || '',
      main_status: rule.main_status,
      trigger_type: rule.trigger_type,
      trigger_config: rule.trigger_config || {},
      condition_type: rule.condition_type || 'no_condition',
      condition_config: rule.condition_config || {},
      action_type: rule.action_type,
      action_config: {
        ...rule.action_config,
        due_date_base: rule.action_config?.due_date_base || '',
        due_date_offset: rule.action_config?.due_date_offset || 0,
        due_date_direction: rule.action_config?.due_date_direction || 'after'
      },
      execution_frequency_days: rule.execution_frequency_days || 1
    });
    setShowNewRuleForm(true);
  }

  function renderTriggerDetails(rule: AutomationRule) {
    const triggerLabel = TRIGGER_TYPES.find(t => t.value === rule.trigger_type)?.label || rule.trigger_type;

    if (rule.trigger_type === 'task_completed' && rule.trigger_config.task_name) {
      return `${triggerLabel}: "${rule.trigger_config.task_name}"`;
    }

    if (rule.trigger_type === 'status_changed' && rule.trigger_config.status_id) {
      const status = statuses.find(s => s.id === rule.trigger_config.status_id);
      return `${triggerLabel}: ${status?.name || 'Unknown Status'}`;
    }

    if (rule.trigger_type === 'label_added' && rule.trigger_config.label_id) {
      const label = labels.find(l => l.id === rule.trigger_config.label_id);
      return `${triggerLabel}: ${label?.name || 'Unknown Label'}`;
    }

    if (rule.trigger_type === 'periodic' && rule.trigger_config) {
      const execFreq = rule.execution_frequency_days || 1;
      const actionFreq = rule.trigger_config.frequency || '?';
      const dateField = rule.trigger_config.date_field || 'project start';
      return `${triggerLabel} - Runs every ${execFreq} day(s), Action on day ${actionFreq}, ${actionFreq * 2}, ${actionFreq * 3}... from ${dateField}`;
    }

    return triggerLabel;
  }

  function renderActionDetails(rule: AutomationRule) {
    const actionLabel = ACTION_TYPES.find(a => a.value === rule.action_type)?.label || rule.action_type;

    if (rule.action_type === 'add_task' && rule.action_config.title) {
      let details = `${actionLabel}: "${rule.action_config.title}"`;
      if (rule.action_config.due_date_base) {
        const offset = rule.action_config.due_date_offset || 0;
        const direction = rule.action_config.due_date_direction || 'after';
        const dateLabel = rule.action_config.due_date_base.replace(/_/g, ' ');
        details += ` (Due: ${offset} days ${direction} ${dateLabel})`;
      }
      return details;
    }

    if ((rule.action_type === 'add_label' || rule.action_type === 'remove_label') && rule.action_config.label_id) {
      const label = labels.find(l => l.id === rule.action_config.label_id);
      return `${actionLabel}: ${label?.name || 'Unknown Label'}`;
    }

    return actionLabel;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{projectTypeName} Automation</h2>
          <p className="text-slate-600 text-sm mt-1">Configure automated actions for {projectTypeName.toLowerCase()} projects</p>
        </div>
        <button
          onClick={() => setShowNewRuleForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
            <Zap className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No automation rules yet</p>
            <p className="text-slate-500 text-sm mt-1">Create your first rule to automate project workflows</p>
          </div>
        ) : (
          rules.map(rule => (
            <div key={rule.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{rule.name}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      {rule.main_status}
                    </span>
                    {rule.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">TRIGGER</p>
                      <p className="text-sm text-slate-700">{renderTriggerDetails(rule)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">ACTION</p>
                      <p className="text-sm text-slate-700">{renderActionDetails(rule)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => editRule(rule)}
                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleRuleActive(rule.id, rule.is_active)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={rule.is_active ? 'Deactivate' : 'Activate'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showNewRuleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-slate-900">{editingRule ? 'Edit Automation Rule' : 'New Automation Rule'}</h3>
              <button
                onClick={() => {
                  setShowNewRuleForm(false);
                  setEditingRule(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Rule Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Add follow-up task when HKPC date is set"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {!projectTypeId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Type *</label>
                  <select
                    value={formData.project_type_id}
                    onChange={(e) => setFormData({ ...formData, project_type_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select project type...</option>
                    {projectTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status *</label>
                <select
                  value={formData.main_status}
                  onChange={(e) => setFormData({ ...formData, main_status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select status...</option>
                  {MAIN_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Trigger</h4>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Trigger Type</label>
                  <select
                    value={formData.trigger_type}
                    onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value as any, trigger_config: {} })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TRIGGER_TYPES.map(trigger => (
                      <option key={trigger.value} value={trigger.value}>{trigger.label}</option>
                    ))}
                  </select>
                </div>

                {formData.trigger_type === 'task_completed' && (
                  <div className="ml-4 p-3 bg-slate-50 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Task Name</label>
                    <input
                      type="text"
                      placeholder="Enter the task name"
                      value={formData.trigger_config.task_name || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        trigger_config: { ...formData.trigger_config, task_name: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {formData.trigger_type === 'status_changed' && (
                  <div className="ml-4 p-3 bg-slate-50 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                    <select
                      value={formData.trigger_config.status_id || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        trigger_config: { ...formData.trigger_config, status_id: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select substatus...</option>
                      {statuses.filter(status => status.is_substatus).map(status => (
                        <option key={status.id} value={status.id}>{status.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.trigger_type === 'label_added' && (
                  <div className="ml-4 p-3 bg-slate-50 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Label</label>
                    <select
                      value={formData.trigger_config.label_id || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        trigger_config: { ...formData.trigger_config, label_id: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select label...</option>
                      {labels.map(label => (
                        <option key={label.id} value={label.id}>{label.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.trigger_type === 'periodic' && (
                  <div className="space-y-3 ml-4 p-3 bg-slate-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Execution Frequency (days)
                      </label>
                      <p className="text-xs text-slate-500 mb-2">How often this automation runs (1 = daily, 7 = weekly, etc.)</p>
                      <input
                        type="number"
                        min="1"
                        value={formData.execution_frequency_days || 1}
                        onChange={(e) => setFormData({
                          ...formData,
                          execution_frequency_days: parseInt(e.target.value) || 1
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Action Frequency (N days)
                      </label>
                      <p className="text-xs text-slate-500 mb-2">How often the action triggers from start date (e.g., day 30, 60, 90...)</p>
                      <input
                        type="number"
                        min="1"
                        value={formData.trigger_config.frequency || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          trigger_config: { ...formData.trigger_config, frequency: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Start from date field</label>
                      <select
                        value={formData.trigger_config.date_field || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          trigger_config: { ...formData.trigger_config, date_field: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select date field...</option>
                        <option value="start_date">Start Date</option>
                        <option value="project_start_date">Project Start Date</option>
                        <option value="submission_date">Submission Date</option>
                        <option value="approval_date">Approval Date</option>
                        <option value="next_hkpc_due_date">Next HKPC Due Date</option>
                      </select>
                    </div>
                  </div>
                )}

                {formData.trigger_type === 'days_after_date' && (
                  <div className="space-y-3 ml-4 p-3 bg-slate-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Number of days</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g., 7"
                        value={formData.trigger_config.days_offset || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          trigger_config: { ...formData.trigger_config, days_offset: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">After date field</label>
                      <select
                        value={formData.trigger_config.date_field || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          trigger_config: { ...formData.trigger_config, date_field: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select date field...</option>
                        <option value="created_at">Project Create Date</option>
                        <option value="start_date">Start Date</option>
                        <option value="project_start_date">Project Start Date</option>
                        <option value="project_end_date">Project End Date</option>
                        <option value="submission_date">Submission Date</option>
                        <option value="approval_date">Approval Date</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Condition (If)</h4>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Condition Type</label>
                  <select
                    value={formData.condition_type}
                    onChange={(e) => setFormData({ ...formData, condition_type: e.target.value as any, condition_config: {} })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CONDITION_TYPES.map(condition => (
                      <option key={condition.value} value={condition.value}>{condition.label}</option>
                    ))}
                  </select>
                </div>

                {formData.condition_type === 'sales_source' && (
                  <div className="ml-4 p-3 bg-slate-50 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Sales Source</label>
                    <input
                      type="text"
                      placeholder="e.g., Direct, CP0001, CP0002"
                      value={formData.condition_config.sales_source || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        condition_config: { ...formData.condition_config, sales_source: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {formData.condition_type === 'sales_person' && (
                  <div className="ml-4 p-3 bg-slate-50 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Sales Person</label>
                    <select
                      value={formData.condition_config.sales_person_id || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        condition_config: { ...formData.condition_config, sales_person_id: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select sales person...</option>
                      {staff.map(person => (
                        <option key={person.id} value={person.id}>{person.full_name || person.email}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Action</h4>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Action Type</label>
                  <select
                    value={formData.action_type}
                    onChange={(e) => setFormData({ ...formData, action_type: e.target.value as any, action_config: {} })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ACTION_TYPES.map(action => (
                      <option key={action.value} value={action.value}>{action.label}</option>
                    ))}
                  </select>
                </div>

                {formData.action_type === 'add_task' && (
                  <div className="space-y-3 ml-4 p-3 bg-slate-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Task Title</label>
                      <input
                        type="text"
                        value={formData.action_config.title || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          action_config: { ...formData.action_config, title: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Assign To</label>
                      <select
                        value={formData.action_config.assigned_to || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          action_config: { ...formData.action_config, assigned_to: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Unassigned</option>
                        <option value="__project_sales_person__">Project Sales Person</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                        ))}
                      </select>
                    </div>
                    <div className="border-t border-slate-300 pt-3 mt-3">
                      <label className="block text-sm font-semibold text-slate-900 mb-3">Task Due Date (Optional)</label>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-2">Base Date Field</label>
                          <select
                            value={formData.action_config.due_date_base || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              action_config: { ...formData.action_config, due_date_base: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">No due date</option>
                            <option value="current_day">Current Day</option>
                            <option value="project_end_date">Project End Date</option>
                            <option value="next_hkpc_due_date">Next HKPC Due Date</option>
                            <option value="start_date">Start Date</option>
                            <option value="project_start_date">Project Start Date</option>
                            <option value="submission_date">Submission Date</option>
                            <option value="approval_date">Approval Date</option>
                          </select>
                        </div>
                        {formData.action_config.due_date_base && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-2">Number of Days</label>
                              <input
                                type="number"
                                min="0"
                                value={formData.action_config.due_date_offset || 0}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  action_config: { ...formData.action_config, due_date_offset: parseInt(e.target.value) || 0 }
                                })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-2">Before/After</label>
                              <select
                                value={formData.action_config.due_date_direction || 'after'}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  action_config: { ...formData.action_config, due_date_direction: e.target.value }
                                })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              >
                                <option value="before">Before</option>
                                <option value="after">After</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {(formData.action_type === 'add_label' || formData.action_type === 'remove_label') && (
                  <div className="ml-4 p-3 bg-slate-50 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Label</label>
                    <select
                      value={formData.action_config.label_id || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        action_config: { ...formData.action_config, label_id: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select label...</option>
                      {labels.map(label => (
                        <option key={label.id} value={label.id}>{label.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.action_type === 'change_status' && (
                  <div className="ml-4 p-3 bg-slate-50 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Change to Status</label>
                    {!formData.project_type_id && (
                      <p className="text-sm text-amber-600 mb-2">Please select a Project Type first</p>
                    )}
                    <select
                      value={formData.action_config.status_id || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        action_config: { ...formData.action_config, status_id: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!formData.project_type_id}
                    >
                      <option value="">Select status...</option>
                      {formData.project_type_id && statuses
                        .filter(s => s.project_type_id === formData.project_type_id && !s.is_substatus)
                        .sort((a, b) => a.order_index - b.order_index)
                        .map(parentStatus => {
                          const substatuses = statuses.filter(s => s.parent_status_id === parentStatus.id).sort((a, b) => a.order_index - b.order_index);
                          return (
                            <optgroup key={parentStatus.id} label={parentStatus.name}>
                              <option key={`parent-${parentStatus.id}`} value={parentStatus.id}>
                                {parentStatus.name} (Main)
                              </option>
                              {substatuses.map(substatus => (
                                <option key={substatus.id} value={substatus.id}>
                                  {substatus.name}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                    </select>
                  </div>
                )}

                {formData.action_type === 'set_field_value' && (
                  <div className="ml-4 p-3 bg-slate-50 rounded-lg space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Field to Set</label>
                      <select
                        value={formData.action_config.field_name || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          action_config: {
                            ...formData.action_config,
                            field_name: e.target.value,
                            value_type: e.target.value ? 'current_date' : ''
                          }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select field...</option>
                        <option value="project_start_date">Project Start Date</option>
                        <option value="project_end_date">Project End Date</option>
                        <option value="submission_date">Submission Date</option>
                        <option value="approval_date">Approval Date</option>
                        <option value="next_hkpc_due_date">Next HKPC Due Date</option>
                        <option value="next_due_date">Next Due Date</option>
                      </select>
                    </div>

                    {formData.action_config.field_name && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Value Type</label>
                        <select
                          value={formData.action_config.value_type || 'current_date'}
                          onChange={(e) => setFormData({
                            ...formData,
                            action_config: { ...formData.action_config, value_type: e.target.value, date_value: '' }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="current_date">Current Date</option>
                          <option value="specific_date">Specific Date</option>
                        </select>
                      </div>
                    )}

                    {formData.action_config.field_name && formData.action_config.value_type === 'specific_date' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Date Value</label>
                        <input
                          type="date"
                          value={formData.action_config.date_value || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            action_config: { ...formData.action_config, date_value: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowNewRuleForm(false);
                    setEditingRule(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRule}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? (editingRule ? 'Updating...' : 'Creating...') : (editingRule ? 'Update Rule' : 'Create Rule')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
