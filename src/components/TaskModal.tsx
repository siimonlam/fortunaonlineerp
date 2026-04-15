import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X, Plus, Calendar, User, Trash2, CheckCircle2, Circle,
  Building2, Mail, Phone, MapPin, Link as LinkIcon,
  CreditCard as Edit2, AlertCircle, CalendarClock, Repeat, RefreshCw
} from 'lucide-react';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  deadline: string | null;
  completed: boolean;
  is_urgent: boolean;
  is_recurring: boolean;
  recurrence_type: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_interval: number;
  parent_task_id: string | null;
  staff?: { full_name: string };
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  client_id?: string;
  company_name?: string;
  contact_name?: string;
  contact_number?: string;
  email?: string;
  address?: string;
  sales_source?: string;
  sales_person_id?: string;
  upload_link?: string;
  start_date?: string;
  attachment?: string;
  deposit_paid?: boolean;
  deposit_amount?: number;
  project_name?: string;
  service_fee_percentage?: number;
  whatsapp_group_id?: string;
  invoice_number?: string;
  agreement_ref?: string;
  abbreviation?: string;
  project_size?: string;
  project_start_date?: string;
  project_end_date?: string;
  submission_date?: string;
  application_number?: string;
  approval_date?: string;
  next_hkpc_due_date?: string;
  next_due_date?: string;
  tasks?: Task[];
}

interface TaskModalProps {
  project: Project;
  staff: Staff[];
  onClose: () => void;
  onSuccess: () => void;
  isMarketing?: boolean;
}

function RecurrenceBadge({ task }: { task: Task }) {
  if (!task.is_recurring || !task.recurrence_type) return null;
  const labels: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
  const interval = task.recurrence_interval > 1 ? ` ×${task.recurrence_interval}` : '';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
      <Repeat className="w-3 h-3" />
      {labels[task.recurrence_type]}{interval}
    </span>
  );
}

interface RecurrenceFieldsProps {
  isRecurring: boolean;
  setIsRecurring: (v: boolean) => void;
  recurrenceType: string;
  setRecurrenceType: (v: string) => void;
  recurrenceInterval: number;
  setRecurrenceInterval: (v: number) => void;
}

function RecurrenceFields({ isRecurring, setIsRecurring, recurrenceType, setRecurrenceType, recurrenceInterval, setRecurrenceInterval }: RecurrenceFieldsProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={e => setIsRecurring(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
          <Repeat className="w-4 h-4 text-blue-500" />
          Make this a recurring task
        </span>
      </label>
      {isRecurring && (
        <div className="ml-6 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <span className="text-xs text-slate-600 whitespace-nowrap">Repeat every</span>
          <input
            type="number"
            min={1}
            max={99}
            value={recurrenceInterval}
            onChange={e => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <select
            value={recurrenceType}
            onChange={e => setRecurrenceType(e.target.value)}
            className="px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">day(s)</option>
            <option value="weekly">week(s)</option>
            <option value="monthly">month(s)</option>
          </select>
        </div>
      )}
    </div>
  );
}

export function TaskModal({ project, staff, onClose, onSuccess, isMarketing = false }: TaskModalProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskIsUrgent, setNewTaskIsUrgent] = useState(false);
  const [newTaskIsRecurring, setNewTaskIsRecurring] = useState(false);
  const [newTaskRecurrenceType, setNewTaskRecurrenceType] = useState('weekly');
  const [newTaskRecurrenceInterval, setNewTaskRecurrenceInterval] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editIsUrgent, setEditIsUrgent] = useState(false);
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrenceType, setEditRecurrenceType] = useState('weekly');
  const [editRecurrenceInterval, setEditRecurrenceInterval] = useState(1);

  const tasksTable = isMarketing ? 'marketing_tasks' : 'tasks';
  const projectIdField = isMarketing ? 'marketing_project_id' : 'project_id';

  useEffect(() => {
    loadTasks();
    checkAdminStatus();
  }, [project.id, user]);

  async function checkAdminStatus() {
    if (!user) return;
    const { data } = await supabase.from('staff').select('role').eq('id', user.id).maybeSingle();
    setIsAdmin(data?.role === 'admin');
  }

  async function loadTasks() {
    const { data } = await supabase
      .from(tasksTable)
      .select('*, staff:assigned_to(full_name)')
      .eq(projectIdField, project.id)
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from(tasksTable).insert({
        [projectIdField]: project.id,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        assigned_to: newTaskAssignee || null,
        deadline: newTaskDeadline || null,
        is_urgent: newTaskIsUrgent,
        is_recurring: newTaskIsRecurring,
        recurrence_type: newTaskIsRecurring ? newTaskRecurrenceType : null,
        recurrence_interval: newTaskIsRecurring ? newTaskRecurrenceInterval : 1,
      });
      if (error) throw error;
      setNewTaskTitle(''); setNewTaskDescription(''); setNewTaskAssignee('');
      setNewTaskDeadline(''); setNewTaskIsUrgent(false); setNewTaskIsRecurring(false);
      setNewTaskRecurrenceType('weekly'); setNewTaskRecurrenceInterval(1);
      setShowAddTask(false);
      await loadTasks();
    } catch (error: unknown) {
      alert(`Failed to add task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleComplete(taskId: string, completed: boolean) {
    const newStatus = !completed;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from(tasksTable)
      .update({ completed: newStatus, completed_at: newStatus ? now : null, updated_at: now })
      .eq('id', taskId);
    if (!error) {
      await loadTasks();
      if (newStatus) {
        const task = tasks.find(t => t.id === taskId);
        if (task) await triggerTaskCompletedAutomation(task.title);
      }
    }
  }

  async function triggerTaskCompletedAutomation(taskTitle: string) {
    try {
      const projectTable = isMarketing ? 'marketing_projects' : 'projects';
      const { data: projectData } = await supabase
        .from(projectTable).select('id, project_type_id, status_id').eq('id', project.id).maybeSingle();
      if (!projectData?.status_id) return;
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-automation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ project_id: project.id, project_type_id: projectData.project_type_id, status_id: projectData.status_id, trigger_type: 'task_completed', trigger_data: { task_name: taskTitle } }),
      });
    } catch (err) { console.error('Automation error:', err); }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    const { error } = await supabase.from(tasksTable).delete().eq('id', taskId);
    if (!error) loadTasks();
  }

  function startEditTask(task: Task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditAssignee(task.assigned_to || '');
    setEditDeadline(task.deadline ? task.deadline.split('T')[0] : '');
    setEditIsUrgent(task.is_urgent || false);
    setEditIsRecurring(task.is_recurring || false);
    setEditRecurrenceType(task.recurrence_type || 'weekly');
    setEditRecurrenceInterval(task.recurrence_interval || 1);
  }

  function cancelEdit() {
    setEditingTaskId(null); setEditTitle(''); setEditDescription('');
    setEditAssignee(''); setEditDeadline(''); setEditIsUrgent(false);
    setEditIsRecurring(false); setEditRecurrenceType('weekly'); setEditRecurrenceInterval(1);
  }

  async function handleUpdateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTaskId || !editTitle.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from(tasksTable)
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          assigned_to: editAssignee || null,
          deadline: editDeadline || null,
          is_urgent: editIsUrgent,
          is_recurring: editIsRecurring,
          recurrence_type: editIsRecurring ? editRecurrenceType : null,
          recurrence_interval: editIsRecurring ? editRecurrenceInterval : 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTaskId);
      if (error) throw error;
      cancelEdit();
      loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handlePostponeDeadline() {
    if (!editDeadline) { alert('Please set a due date first.'); return; }
    const d = new Date(editDeadline);
    d.setDate(d.getDate() + 1);
    setEditDeadline(d.toISOString().split('T')[0]);
  }

  async function handleDeleteProject() {
    if (!isAdmin) { alert('Only administrators can delete projects'); return; }
    if (!confirm(`Are you sure you want to delete the project "${project.title}"? This action cannot be undone.`)) return;
    setLoading(true);
    try {
      const projectTable = isMarketing ? 'marketing_projects' : 'projects';
      const { error } = await supabase.from(projectTable).delete().eq('id', project.id);
      if (error) throw error;
      alert('Project deleted successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. You may not have permission.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{project.title}</h2>
            {project.description && <p className="text-sm text-slate-600 mt-1">{project.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={handleDeleteProject} disabled={loading} className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                <Trash2 className="w-4 h-4" />Delete Project
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(project.company_name || project.client_id) && (
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Client Information</h3>
            <div className="grid grid-cols-2 gap-4">
              {project.client_id && <div className="text-sm"><span className="text-slate-500">Client ID:</span><span className="ml-2 text-slate-900 font-medium">{project.client_id}</span></div>}
              {project.company_name && <div className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-slate-400" /><span className="text-slate-900">{project.company_name}</span></div>}
              {project.contact_name && <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-slate-400" /><span className="text-slate-900">{project.contact_name}</span></div>}
              {project.contact_number && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-slate-400" /><span className="text-slate-900">{project.contact_number}</span></div>}
              {project.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-slate-400" /><span className="text-slate-900">{project.email}</span></div>}
              {project.address && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-slate-400" /><span className="text-slate-900">{project.address}</span></div>}
              {project.sales_source && <div className="text-sm"><span className="text-slate-500">Sales Source:</span><span className="ml-2 text-slate-900">{project.sales_source}</span></div>}
              {project.start_date && <div className="text-sm"><span className="text-slate-500">Start Date:</span><span className="ml-2 text-slate-900">{new Date(project.start_date).toLocaleDateString()}</span></div>}
              {project.project_name && <div className="text-sm"><span className="text-slate-500">Project Name:</span><span className="ml-2 text-slate-900">{project.project_name}</span></div>}
              {project.abbreviation && <div className="text-sm"><span className="text-slate-500">Abbreviation:</span><span className="ml-2 text-slate-900 font-medium">{project.abbreviation}</span></div>}
              {project.project_size && <div className="text-sm"><span className="text-slate-500">Project Size:</span><span className="ml-2 text-slate-900">{project.project_size}</span></div>}
              {project.application_number && <div className="text-sm"><span className="text-slate-500">Application Number:</span><span className="ml-2 text-slate-900 font-medium">{project.application_number}</span></div>}
              {project.agreement_ref && <div className="text-sm"><span className="text-slate-500">Agreement Ref:</span><span className="ml-2 text-slate-900">{project.agreement_ref}</span></div>}
              {project.invoice_number && <div className="text-sm"><span className="text-slate-500">Invoice Number:</span><span className="ml-2 text-slate-900">{project.invoice_number}</span></div>}
              {project.deposit_paid !== undefined && (
                <div className="text-sm"><span className="text-slate-500">Deposit Paid:</span><span className={`ml-2 font-medium ${project.deposit_paid ? 'text-green-600' : 'text-slate-900'}`}>{project.deposit_paid ? 'Yes' : 'No'}</span></div>
              )}
              {project.deposit_amount && <div className="text-sm"><span className="text-slate-500">Deposit Amount:</span><span className="ml-2 text-slate-900 font-medium">${project.deposit_amount.toLocaleString()}</span></div>}
              {project.service_fee_percentage && <div className="text-sm"><span className="text-slate-500">Service Fee:</span><span className="ml-2 text-slate-900">{project.service_fee_percentage}%</span></div>}
              {project.project_start_date && <div className="text-sm"><span className="text-slate-500">Project Start:</span><span className="ml-2 text-slate-900">{new Date(project.project_start_date).toLocaleDateString()}</span></div>}
              {project.project_end_date && <div className="text-sm"><span className="text-slate-500">Project End:</span><span className="ml-2 text-slate-900">{new Date(project.project_end_date).toLocaleDateString()}</span></div>}
              {project.submission_date && <div className="text-sm"><span className="text-slate-500">Submission Date:</span><span className="ml-2 text-slate-900">{new Date(project.submission_date).toLocaleDateString()}</span></div>}
              {project.approval_date && <div className="text-sm"><span className="text-slate-500">Approval Date:</span><span className="ml-2 text-slate-900">{new Date(project.approval_date).toLocaleDateString()}</span></div>}
              {project.next_hkpc_due_date && <div className="text-sm"><span className="text-slate-500">Next HKPC Due:</span><span className="ml-2 text-slate-900">{new Date(project.next_hkpc_due_date).toLocaleString()}</span></div>}
              {project.next_due_date && <div className="text-sm"><span className="text-slate-500">Next Due Date:</span><span className="ml-2 text-slate-900">{new Date(project.next_due_date).toLocaleDateString()}</span></div>}
              {project.whatsapp_group_id && <div className="text-sm"><span className="text-slate-500">WhatsApp Group:</span><span className="ml-2 text-slate-900">{project.whatsapp_group_id}</span></div>}
              {project.upload_link && (
                <div className="flex items-center gap-2 text-sm col-span-2">
                  <LinkIcon className="w-4 h-4 text-slate-400" />
                  <a href={project.upload_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">{project.upload_link}</a>
                </div>
              )}
              {project.attachment && (
                <div className="flex items-center gap-2 text-sm col-span-2">
                  <LinkIcon className="w-4 h-4 text-slate-400" />
                  <a href={project.attachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">Attachment</a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Tasks</h3>
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />Add Task
            </button>
          </div>

          {showAddTask && (
            <form onSubmit={handleAddTask} className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3 border border-slate-200">
              <input
                type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Task title" required
              />
              <textarea
                value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Task description (optional)" rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Unassigned</option>
                  {staff.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
                <input
                  type="date" value={newTaskDeadline} onChange={e => setNewTaskDeadline(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newTaskIsUrgent} onChange={e => setNewTaskIsUrgent(e.target.checked)} className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-2 focus:ring-red-500" />
                <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><AlertCircle className="w-4 h-4 text-red-500" />Mark as Urgent</span>
              </label>
              <RecurrenceFields
                isRecurring={newTaskIsRecurring} setIsRecurring={setNewTaskIsRecurring}
                recurrenceType={newTaskRecurrenceType} setRecurrenceType={setNewTaskRecurrenceType}
                recurrenceInterval={newTaskRecurrenceInterval} setRecurrenceInterval={setNewTaskRecurrenceInterval}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddTask(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{loading ? 'Adding...' : 'Add Task'}</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {tasks.length === 0 && !showAddTask && (
              <p className="text-center text-slate-500 py-8">No tasks yet. Add your first task to get started.</p>
            )}
            {tasks.map(task => (
              <div key={task.id} className={`border rounded-lg p-4 hover:border-slate-300 transition-colors ${task.is_recurring && !task.completed ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'}`}>
                {editingTaskId === task.id ? (
                  <form onSubmit={handleUpdateTask} className="space-y-3">
                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Task title" required />
                    <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Task description (optional)" rows={2} />
                    <div className="grid grid-cols-2 gap-3">
                      <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Unassigned</option>
                        {staff.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button type="button" onClick={handlePostponeDeadline} disabled={!editDeadline} className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1" title="Postpone due date by 1 day">
                          <CalendarClock className="w-4 h-4" />+1
                        </button>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editIsUrgent} onChange={e => setEditIsUrgent(e.target.checked)} className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-2 focus:ring-red-500" />
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><AlertCircle className="w-4 h-4 text-red-500" />Mark as Urgent</span>
                    </label>
                    <RecurrenceFields
                      isRecurring={editIsRecurring} setIsRecurring={setEditIsRecurring}
                      recurrenceType={editRecurrenceType} setRecurrenceType={setEditRecurrenceType}
                      recurrenceInterval={editRecurrenceInterval} setRecurrenceInterval={setEditRecurrenceInterval}
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={cancelEdit} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors">Cancel</button>
                      <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{loading ? 'Saving...' : 'Save'}</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start gap-3">
                    <button onClick={() => handleToggleComplete(task.id, task.completed)} className="mt-0.5 flex-shrink-0">
                      {task.completed ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-slate-400 hover:text-slate-600" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</h4>
                        {task.is_urgent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                            <AlertCircle className="w-3 h-3" />Urgent
                          </span>
                        )}
                        <RecurrenceBadge task={task} />
                        {task.is_recurring && task.completed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <RefreshCw className="w-3 h-3" />Next spawned
                          </span>
                        )}
                      </div>
                      {task.description && <p className="text-sm text-slate-600 mt-1">{task.description}</p>}
                      <div className="flex items-center gap-4 mt-2">
                        {task.staff && <div className="flex items-center gap-1 text-sm text-slate-600"><User className="w-4 h-4" />{task.staff.full_name}</div>}
                        {task.deadline && <div className="flex items-center gap-1 text-sm text-slate-600"><Calendar className="w-4 h-4" />{new Date(task.deadline).toLocaleDateString()}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startEditTask(task)} className="text-slate-400 hover:text-blue-600 transition-colors p-1"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteTask(task.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
