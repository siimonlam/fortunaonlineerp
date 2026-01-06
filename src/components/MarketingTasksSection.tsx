import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, CheckCircle2, Circle, Calendar, User, Link as LinkIcon, Edit2, X } from 'lucide-react';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  links: string | null;
  assigned_to: string | null;
  deadline: string | null;
  completed: boolean;
  staff?: {
    full_name: string;
  };
}

interface MarketingProject {
  id: string;
  title: string;
  brand_name: string;
}

interface MarketingTasksSectionProps {
  projectId: string;
  project: MarketingProject | null;
  onTasksChange?: () => void;
}

export function MarketingTasksSection({ projectId, project, onTasksChange }: MarketingTasksSectionProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskLinks, setNewTaskLinks] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLinks, setEditLinks] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDeadline, setEditDeadline] = useState('');

  useEffect(() => {
    loadTasks();
    loadStaff();
  }, [projectId]);

  async function loadTasks() {
    try {
      const { data, error } = await supabase
        .from('marketing_tasks')
        .select(`
          *,
          staff:assigned_to(full_name)
        `)
        .eq('marketing_project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      console.error('Error loading tasks:', err);
    }
  }

  async function loadStaff() {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setStaff(data || []);
    } catch (err: any) {
      console.error('Error loading staff:', err);
    }
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('marketing_tasks')
        .insert({
          marketing_project_id: projectId,
          title: newTaskTitle,
          description: newTaskDescription || null,
          links: newTaskLinks || null,
          assigned_to: newTaskAssignee || null,
          deadline: newTaskDeadline || null,
          completed: false,
        });

      if (error) throw error;

      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskLinks('');
      setNewTaskAssignee('');
      const today = new Date();
      setNewTaskDeadline(today.toISOString().split('T')[0]);
      setShowAddTask(false);

      await loadTasks();
      if (onTasksChange) onTasksChange();
    } catch (err: any) {
      console.error('Error adding task:', err);
      alert('Failed to add task');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleComplete(taskId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('marketing_tasks')
        .update({ completed: !currentStatus })
        .eq('id', taskId);

      if (error) throw error;

      await loadTasks();
      if (onTasksChange) onTasksChange();
    } catch (err: any) {
      console.error('Error toggling task:', err);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const { error } = await supabase
        .from('marketing_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      await loadTasks();
      if (onTasksChange) onTasksChange();
    } catch (err: any) {
      console.error('Error deleting task:', err);
    }
  }

  function startEditTask(task: Task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditLinks(task.links || '');
    setEditAssignee(task.assigned_to || '');
    setEditDeadline(task.deadline ? task.deadline.split('T')[0] : '');
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditTitle('');
    setEditDescription('');
    setEditLinks('');
    setEditAssignee('');
    setEditDeadline('');
  }

  async function handleSaveEdit(taskId: string) {
    if (!editTitle.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('marketing_tasks')
        .update({
          title: editTitle,
          description: editDescription || null,
          links: editLinks || null,
          assigned_to: editAssignee || null,
          deadline: editDeadline || null,
        })
        .eq('id', taskId);

      if (error) throw error;

      cancelEdit();
      await loadTasks();
      if (onTasksChange) onTasksChange();
    } catch (err: any) {
      console.error('Error updating task:', err);
      alert('Failed to update task');
    } finally {
      setLoading(false);
    }
  }

  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Tasks</h3>
          <p className="text-sm text-slate-600 mt-1">Manage tasks for {project?.brand_name}</p>
        </div>
        <button
          onClick={() => setShowAddTask(!showAddTask)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddTask ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddTask ? 'Cancel' : 'Add Task'}
        </button>
      </div>

      {showAddTask && (
        <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h4 className="font-semibold text-slate-900 mb-3">New Task</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Task title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Task description"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <LinkIcon className="w-4 h-4 inline mr-1" />
                Links
              </label>
              <input
                type="text"
                value={newTaskLinks}
                onChange={(e) => setNewTaskLinks(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com or multiple links separated by commas"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  Assigned To
                </label>
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Deadline
                </label>
                <input
                  type="date"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddTask(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                disabled={loading || !newTaskTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {incompleteTasks.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">
              Active Tasks ({incompleteTasks.length})
            </h4>
            <div className="space-y-2">
              {incompleteTasks.map(task => (
                <div key={task.id} className="bg-white border border-slate-200 rounded-lg p-4">
                  {editingTaskId === task.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                      <input
                        type="text"
                        value={editLinks}
                        onChange={(e) => setEditLinks(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Links"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={editAssignee}
                          onChange={(e) => setEditAssignee(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Unassigned</option>
                          {staff.map(s => (
                            <option key={s.id} value={s.id}>{s.full_name}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={editDeadline}
                          onChange={(e) => setEditDeadline(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(task.id)}
                          disabled={loading}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleComplete(task.id, task.completed)}
                        className="mt-1 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Circle className="w-5 h-5" />
                      </button>
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-900">{task.title}</h5>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}
                        {task.links && (
                          <div className="flex items-center gap-2 mt-2">
                            <LinkIcon className="w-4 h-4 text-blue-600" />
                            {task.links.split(',').map((link, idx) => (
                              <a
                                key={idx}
                                href={link.trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                {link.trim().length > 40 ? link.trim().substring(0, 40) + '...' : link.trim()}
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                          {task.staff && (
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {task.staff.full_name}
                            </span>
                          )}
                          {task.deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(task.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditTask(task)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        )}

        {completedTasks.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">
              Completed Tasks ({completedTasks.length})
            </h4>
            <div className="space-y-2">
              {completedTasks.map(task => (
                <div key={task.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 opacity-75">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleComplete(task.id, task.completed)}
                      className="mt-1 text-green-600 hover:text-slate-400 transition-colors"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                      <h5 className="font-semibold text-slate-700 line-through">{task.title}</h5>
                      {task.description && (
                        <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                      )}
                      {task.links && (
                        <div className="flex items-center gap-2 mt-2">
                          <LinkIcon className="w-4 h-4 text-blue-600" />
                          {task.links.split(',').map((link, idx) => (
                            <a
                              key={idx}
                              href={link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {link.trim().length > 40 ? link.trim().substring(0, 40) + '...' : link.trim()}
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        {task.staff && (
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {task.staff.full_name}
                          </span>
                        )}
                        {task.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No tasks yet. Create one to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
