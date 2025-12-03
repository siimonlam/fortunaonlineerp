import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Calendar, MapPin, Users, CheckSquare, Square, Trash2, Edit, X, User } from 'lucide-react';

interface Meeting {
  id: string;
  project_id: string | null;
  title: string;
  description: string;
  meeting_date: string;
  location: string;
  attendees: string[];
  created_by: string | null;
  created_at: string;
}

interface MeetingTask {
  id: string;
  meeting_id: string;
  project_id: string | null;
  title: string;
  description: string;
  assigned_to: string | null;
  deadline: string | null;
  completed: boolean;
  staff?: {
    full_name: string;
  };
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface Project {
  id: string;
  title: string;
}

interface MeetingsPageProps {
  projects: Project[];
}

export function MeetingsPage({ projects }: MeetingsPageProps) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());
  const [meetingTasks, setMeetingTasks] = useState<Record<string, MeetingTask[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: '',
    location: '',
    attendees: [] as string[],
    tasks: [] as { id?: string; title: string; description: string; assigned_to: string | null; deadline: string | null; completed: boolean }[]
  });

  useEffect(() => {
    fetchMeetings();
    fetchStaff();
  }, [projects]);

  const fetchMeetings = async () => {
    let query = supabase
      .from('meetings')
      .select('*')
      .order('meeting_date', { ascending: false });

    if (projects.length > 0) {
      const projectIds = projects.map(p => p.id);
      query = query.or(`project_id.is.null,project_id.in.(${projectIds.join(',')})`);
    } else {
      query = query.is('project_id', null);
    }

    const { data, error } = await query;

    if (!error && data) {
      setMeetings(data);
      data.forEach(meeting => fetchMeetingTasks(meeting.id));
    }
  };

  const fetchMeetingTasks = async (meetingId: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        staff:assigned_to(full_name)
      `)
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMeetingTasks(prev => ({ ...prev, [meetingId]: data }));
    }
  };

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('full_name');

    if (!error && data) {
      setStaff(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const meetingData = {
      project_id: selectedProjectId || null,
      title: formData.title,
      description: formData.description,
      meeting_date: new Date(formData.meeting_date).toISOString(),
      location: formData.location,
      attendees: formData.attendees,
      created_by: user.id
    };

    if (editingMeeting) {
      const { error } = await supabase
        .from('meetings')
        .update(meetingData)
        .eq('id', editingMeeting.id);

      if (!error) {
        await updateTasks(editingMeeting.id);
        fetchMeetings();
        resetForm();
      }
    } else {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert(meetingData)
        .select()
        .single();

      if (!error && meeting) {
        await createTasks(meeting.id);
        fetchMeetings();
        resetForm();
      }
    }
  };

  const createTasks = async (meetingId: string) => {

    const tasksToCreate = formData.tasks.filter(task => task.title.trim());
    if (tasksToCreate.length === 0) return;

    const tasks = tasksToCreate.map(task => ({
      meeting_id: meetingId,
      project_id: selectedProjectId || null,
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to,
      deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
      completed: false
    }));

    await supabase.from('tasks').insert(tasks);
  };

  const updateTasks = async (meetingId: string) => {

    await supabase.from('tasks').delete().eq('meeting_id', meetingId);
    await createTasks(meetingId);
  };

  const deleteMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;

    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meetingId);

    if (!error) {
      fetchMeetings();
    }
  };

  const toggleTaskComplete = async (task: MeetingTask) => {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id);

    if (!error) {
      fetchMeetingTasks(task.meeting_id);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      meeting_date: '',
      location: '',
      attendees: [],
      tasks: []
    });
    setSelectedProjectId('');
    setEditingMeeting(null);
    setShowModal(false);
    setEditingTaskIndex(null);
  };

  const openEditModal = async (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setSelectedProjectId(meeting.project_id || '');
    setEditingTaskIndex(null);

    const { data: tasks } = await supabase
      .from('tasks')
      .select(`
        *,
        staff:assigned_to(full_name)
      `)
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true });

    setFormData({
      title: meeting.title,
      description: meeting.description,
      meeting_date: new Date(meeting.meeting_date).toISOString().slice(0, 16),
      location: meeting.location,
      attendees: meeting.attendees,
      tasks: (tasks || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        assigned_to: task.assigned_to,
        deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : null,
        completed: task.completed || false
      }))
    });
    setShowModal(true);
  };

  const toggleTaskCompleteInModal = async (index: number) => {
    const task = formData.tasks[index];
    if (task.id) {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: !task.completed })
        .eq('id', task.id);

      if (!error) {
        setFormData(prev => ({
          ...prev,
          tasks: prev.tasks.map((t, i) =>
            i === index ? { ...t, completed: !t.completed } : t
          )
        }));
        if (editingMeeting) {
          fetchMeetingTasks(editingMeeting.id);
        }
      }
    } else {
      setFormData(prev => ({
        ...prev,
        tasks: prev.tasks.map((t, i) =>
          i === index ? { ...t, completed: !t.completed } : t
        )
      }));
    }
  };

  const addTaskField = () => {
    const newIndex = formData.tasks.length;
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { title: '', description: '', assigned_to: null, deadline: null, completed: false }]
    }));
    setEditingTaskIndex(newIndex);
  };

  const removeTaskField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
    if (editingTaskIndex === index) {
      setEditingTaskIndex(null);
    } else if (editingTaskIndex !== null && editingTaskIndex > index) {
      setEditingTaskIndex(editingTaskIndex - 1);
    }
  };

  const updateTaskField = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) =>
        i === index ? { ...task, [field]: value } : task
      )
    }));
  };

  const toggleMeetingExpanded = (meetingId: string) => {
    setExpandedMeetings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(meetingId)) {
        newSet.delete(meetingId);
      } else {
        newSet.add(meetingId);
      }
      return newSet;
    });
  };

  const getMeetingProject = (meeting: Meeting) => {
    if (!meeting.project_id) return null;
    return projects.find(p => p.id === meeting.project_id);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar with meetings list */}
      <aside className="w-80 bg-slate-50 border-r border-slate-200 overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Meeting
          </button>
        </div>
        <nav className="p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Meetings
          </h3>
          {meetings.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No meetings yet</p>
          ) : (
            <div className="space-y-2">
              {meetings.map(meeting => (
                <div
                  key={meeting.id}
                  className="group bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-all"
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {meeting.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(meeting.meeting_date).toLocaleDateString()}
                        </p>
                        {getMeetingProject(meeting) && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {getMeetingProject(meeting)?.title}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => openEditModal(meeting)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit meeting"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Team Meetings</h2>

          <div className="space-y-4">
        {meetings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No meetings recorded yet</p>
          </div>
        ) : (
          meetings.map(meeting => (
            <div key={meeting.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{meeting.title}</h3>
                      {getMeetingProject(meeting) && (
                        <span className="text-sm text-slate-500">
                          — {getMeetingProject(meeting)?.title}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {new Date(meeting.meeting_date).toLocaleString()}
                      </div>
                      {meeting.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          {meeting.location}
                        </div>
                      )}
                      {meeting.attendees.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    {meeting.description && (
                      <p className="text-slate-700 mb-3">{meeting.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openEditModal(meeting)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMeeting(meeting.id)}
                      className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {meetingTasks[meeting.id] && meetingTasks[meeting.id].length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => toggleMeetingExpanded(meeting.id)}
                      className="text-sm font-medium text-slate-700 hover:text-slate-900 mb-3"
                    >
                      {meetingTasks[meeting.id].length} Task{meetingTasks[meeting.id].length !== 1 ? 's' : ''} Assigned
                    </button>
                    {expandedMeetings.has(meeting.id) && (
                      <div className="space-y-2 mt-2">
                        {meetingTasks[meeting.id].map(task => (
                          <div
                            key={task.id}
                            className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                          >
                            <button
                              onClick={() => toggleTaskComplete(task)}
                              className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              {task.completed ? (
                                <CheckSquare className="w-5 h-5 text-green-600" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                            <div className="flex-1">
                              <p className={`font-medium ${task.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                              )}
                              <div className="flex gap-4 mt-2 text-sm text-slate-500">
                                {task.staff && (
                                  <span>Assigned to: {task.staff.full_name}</span>
                                )}
                                {task.deadline && (
                                  <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingMeeting ? 'Edit Meeting' : 'Add Meeting'}
                </h3>
                <button
                  onClick={resetForm}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {projects.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Project (Optional)
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">General Meeting (No Project)</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Meeting Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.meeting_date}
                    onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Location / Platform
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Zoom, Office Room 301"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Meeting Notes
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Meeting agenda, discussion points, decisions made..."
                  />
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Tasks to Assign
                    </label>
                    <button
                      type="button"
                      onClick={addTaskField}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add Task
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.tasks.map((task, index) => (
                      <div key={index} className="p-4 bg-slate-50 rounded-lg">
                        {editingTaskIndex === index ? (
                          <div className="space-y-3">
                            <div className="flex items-start gap-2">
                              <input
                                type="text"
                                value={task.title}
                                onChange={(e) => updateTaskField(index, 'title', e.target.value)}
                                placeholder="Task title"
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <textarea
                              value={task.description}
                              onChange={(e) => updateTaskField(index, 'description', e.target.value)}
                              placeholder="Task description"
                              rows={2}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                  Assign To
                                </label>
                                <select
                                  value={task.assigned_to || ''}
                                  onChange={(e) => updateTaskField(index, 'assigned_to', e.target.value || null)}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                  <option value="">Unassigned</option>
                                  {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.full_name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                  Deadline
                                </label>
                                <input
                                  type="datetime-local"
                                  value={task.deadline || ''}
                                  onChange={(e) => updateTaskField(index, 'deadline', e.target.value || null)}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setEditingTaskIndex(null)}
                                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors text-sm"
                              >
                                Done
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTaskField(index)}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleTaskCompleteInModal(index)}
                              className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              {task.completed ? (
                                <CheckSquare className="w-5 h-5 text-green-600" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                            <div className="flex-1">
                              <h4 className={`font-medium ${task.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>{task.title || 'Untitled Task'}</h4>
                              {task.description && (
                                <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2">
                                {task.assigned_to && (
                                  <div className="flex items-center gap-1 text-sm text-slate-600">
                                    <User className="w-4 h-4" />
                                    {staff.find(s => s.id === task.assigned_to)?.full_name || 'Unknown'}
                                  </div>
                                )}
                                {task.deadline && (
                                  <div className="flex items-center gap-1 text-sm text-slate-600">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(task.deadline).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingTaskIndex(index)}
                                className="text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTaskField(index)}
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

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingMeeting ? 'Update Meeting' : 'Create Meeting'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
