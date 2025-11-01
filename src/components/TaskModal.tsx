import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Calendar, User, Trash2, CheckCircle2, Circle, Building2, Mail, Phone, MapPin, Link as LinkIcon, Edit2 } from 'lucide-react';

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
  staff?: {
    full_name: string;
  };
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
}

export function TaskModal({ project, staff, onClose, onSuccess }: TaskModalProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDeadline, setEditDeadline] = useState('');

  useEffect(() => {
    loadTasks();
    checkAdminStatus();
  }, [project.id, user]);

  async function checkAdminStatus() {
    if (!user) return;
    const { data } = await supabase
      .from('staff')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    setIsAdmin(data?.role === 'admin');
  }

  async function loadTasks() {
    const { data } = await supabase
      .from('tasks')
      .select(`
        *,
        staff:assigned_to (full_name)
      `)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (data) setTasks(data);
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        project_id: project.id,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        assigned_to: newTaskAssignee || null,
        deadline: newTaskDeadline || null,
      });

      if (error) throw error;

      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskAssignee('');
      setNewTaskDeadline('');
      setShowAddTask(false);
      loadTasks();
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleComplete(taskId: string, completed: boolean) {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !completed, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (!error) loadTasks();
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (!error) loadTasks();
  }

  function startEditTask(task: Task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditAssignee(task.assigned_to || '');
    setEditDeadline(task.deadline || '');
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditTitle('');
    setEditDescription('');
    setEditAssignee('');
    setEditDeadline('');
  }

  async function handleUpdateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTaskId || !editTitle.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          assigned_to: editAssignee || null,
          deadline: editDeadline || null,
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

  async function handleDeleteProject() {
    if (!isAdmin) {
      alert('Only administrators can delete projects');
      return;
    }

    if (!confirm(`Are you sure you want to delete the project "${project.title}"? This action cannot be undone and will delete all associated tasks.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

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
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{project.title}</h2>
            {project.description && (
              <p className="text-sm text-slate-600 mt-1">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleDeleteProject}
                disabled={loading}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Delete Project
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(project.company_name || project.client_id) && (
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Client Information</h3>
            <div className="grid grid-cols-2 gap-4">
              {project.client_id && (
                <div className="text-sm">
                  <span className="text-slate-500">Client ID:</span>
                  <span className="ml-2 text-slate-900 font-medium">{project.client_id}</span>
                </div>
              )}
              {project.company_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-900">{project.company_name}</span>
                </div>
              )}
              {project.contact_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-900">{project.contact_name}</span>
                </div>
              )}
              {project.contact_number && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-900">{project.contact_number}</span>
                </div>
              )}
              {project.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-900">{project.email}</span>
                </div>
              )}
              {project.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-900">{project.address}</span>
                </div>
              )}
              {project.sales_source && (
                <div className="text-sm">
                  <span className="text-slate-500">Sales Source:</span>
                  <span className="ml-2 text-slate-900">{project.sales_source}</span>
                </div>
              )}
              {project.start_date && (
                <div className="text-sm">
                  <span className="text-slate-500">Start Date:</span>
                  <span className="ml-2 text-slate-900">{new Date(project.start_date).toLocaleDateString()}</span>
                </div>
              )}
              {project.project_name && (
                <div className="text-sm">
                  <span className="text-slate-500">Project Name:</span>
                  <span className="ml-2 text-slate-900">{project.project_name}</span>
                </div>
              )}
              {project.abbreviation && (
                <div className="text-sm">
                  <span className="text-slate-500">Abbreviation:</span>
                  <span className="ml-2 text-slate-900 font-medium">{project.abbreviation}</span>
                </div>
              )}
              {project.project_size && (
                <div className="text-sm">
                  <span className="text-slate-500">Project Size:</span>
                  <span className="ml-2 text-slate-900">{project.project_size}</span>
                </div>
              )}
              {project.application_number && (
                <div className="text-sm">
                  <span className="text-slate-500">Application Number:</span>
                  <span className="ml-2 text-slate-900 font-medium">{project.application_number}</span>
                </div>
              )}
              {project.agreement_ref && (
                <div className="text-sm">
                  <span className="text-slate-500">Agreement Ref:</span>
                  <span className="ml-2 text-slate-900">{project.agreement_ref}</span>
                </div>
              )}
              {project.invoice_number && (
                <div className="text-sm">
                  <span className="text-slate-500">Invoice Number:</span>
                  <span className="ml-2 text-slate-900">{project.invoice_number}</span>
                </div>
              )}
              {project.deposit_paid !== undefined && (
                <div className="text-sm">
                  <span className="text-slate-500">Deposit Paid:</span>
                  <span className={`ml-2 font-medium ${project.deposit_paid ? 'text-green-600' : 'text-slate-900'}`}>
                    {project.deposit_paid ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              {project.deposit_amount && (
                <div className="text-sm">
                  <span className="text-slate-500">Deposit Amount:</span>
                  <span className="ml-2 text-slate-900 font-medium">${project.deposit_amount.toLocaleString()}</span>
                </div>
              )}
              {project.service_fee_percentage && (
                <div className="text-sm">
                  <span className="text-slate-500">Service Fee:</span>
                  <span className="ml-2 text-slate-900">{project.service_fee_percentage}%</span>
                </div>
              )}
              {project.project_start_date && (
                <div className="text-sm">
                  <span className="text-slate-500">Project Start:</span>
                  <span className="ml-2 text-slate-900">{new Date(project.project_start_date).toLocaleDateString()}</span>
                </div>
              )}
              {project.project_end_date && (
                <div className="text-sm">
                  <span className="text-slate-500">Project End:</span>
                  <span className="ml-2 text-slate-900">{new Date(project.project_end_date).toLocaleDateString()}</span>
                </div>
              )}
              {project.submission_date && (
                <div className="text-sm">
                  <span className="text-slate-500">Submission Date:</span>
                  <span className="ml-2 text-slate-900">{new Date(project.submission_date).toLocaleDateString()}</span>
                </div>
              )}
              {project.approval_date && (
                <div className="text-sm">
                  <span className="text-slate-500">Approval Date:</span>
                  <span className="ml-2 text-slate-900">{new Date(project.approval_date).toLocaleDateString()}</span>
                </div>
              )}
              {project.next_hkpc_due_date && (
                <div className="text-sm">
                  <span className="text-slate-500">Next HKPC Due:</span>
                  <span className="ml-2 text-slate-900">{new Date(project.next_hkpc_due_date).toLocaleDateString()}</span>
                </div>
              )}
              {project.next_due_date && (
                <div className="text-sm">
                  <span className="text-slate-500">Next Due Date:</span>
                  <span className="ml-2 text-slate-900">{new Date(project.next_due_date).toLocaleDateString()}</span>
                </div>
              )}
              {project.whatsapp_group_id && (
                <div className="text-sm">
                  <span className="text-slate-500">WhatsApp Group:</span>
                  <span className="ml-2 text-slate-900">{project.whatsapp_group_id}</span>
                </div>
              )}
              {project.upload_link && (
                <div className="flex items-center gap-2 text-sm col-span-2">
                  <LinkIcon className="w-4 h-4 text-slate-400" />
                  <a href={project.upload_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">
                    {project.upload_link}
                  </a>
                </div>
              )}
              {project.attachment && (
                <div className="flex items-center gap-2 text-sm col-span-2">
                  <LinkIcon className="w-4 h-4 text-slate-400" />
                  <a href={project.attachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">
                    Attachment
                  </a>
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
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>

          {showAddTask && (
            <form onSubmit={handleAddTask} className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Task title"
                required
              />
              <textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Task description (optional)"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {tasks.length === 0 && !showAddTask && (
              <p className="text-center text-slate-500 py-8">
                No tasks yet. Add your first task to get started.
              </p>
            )}
            {tasks.map((task) => (
              <div
                key={task.id}
                className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
              >
                {editingTaskId === task.id ? (
                  <form onSubmit={handleUpdateTask} className="space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Task title"
                      required
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Task description (optional)"
                      rows={2}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={editAssignee}
                        onChange={(e) => setEditAssignee(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Unassigned</option>
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleComplete(task.id, task.completed)}
                      className="mt-0.5"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <div className="flex-1">
                      <h4
                        className={`font-medium ${
                          task.completed ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        {task.staff && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <User className="w-4 h-4" />
                            {task.staff.full_name}
                          </div>
                        )}
                        {task.deadline && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Calendar className="w-4 h-4" />
                            {new Date(task.deadline).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditTask(task)}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
