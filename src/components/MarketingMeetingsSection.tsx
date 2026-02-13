import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Calendar, MapPin, Users, CheckSquare, Square, Trash2, Edit, X, User, Clock, AlertCircle } from 'lucide-react';
import { toLocalDateTimeString, fromLocalDateTimeString } from '../utils/dateTimeUtils';

interface Meeting {
  id: string;
  marketing_project_id: string | null;
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
  marketing_project_id: string | null;
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

interface MarketingMeetingsSectionProps {
  marketingProjectId: string;
}

export default function MarketingMeetingsSection({ marketingProjectId }: MarketingMeetingsSectionProps) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());
  const [meetingTasks, setMeetingTasks] = useState<Record<string, MeetingTask[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_date: '',
    location: '',
    attendees: [] as string[],
    attendeeInput: '',
    tasks: [] as { id?: string; title: string; description: string; assigned_to: string | null; deadline: string | null }[]
  });

  useEffect(() => {
    fetchMeetings();
    fetchStaff();
  }, [marketingProjectId]);

  const fetchMeetings = async () => {
    const { data, error } = await supabase
      .from('marketing_meetings')
      .select('*')
      .eq('marketing_project_id', marketingProjectId)
      .order('meeting_date', { ascending: false });

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
    if (!user) {
      setError('You must be logged in to create a meeting');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const meetingData = {
        marketing_project_id: marketingProjectId,
        title: formData.title,
        description: formData.description,
        meeting_date: new Date(formData.meeting_date).toISOString(),
        location: formData.location,
        attendees: formData.attendees,
        created_by: user.id
      };

      if (editingMeeting) {
        const { error } = await supabase
          .from('marketing_meetings')
          .update(meetingData)
          .eq('id', editingMeeting.id);

        if (error) {
          console.error('Error updating meeting:', error);
          setError(`Failed to update meeting: ${error.message}`);
          setSubmitting(false);
          return;
        }

        await updateTasks(editingMeeting.id);
        fetchMeetings();
        resetForm();
      } else {
        const { data: meeting, error } = await supabase
          .from('marketing_meetings')
          .insert(meetingData)
          .select()
          .single();

        if (error) {
          console.error('Error creating meeting:', error);
          setError(`Failed to create meeting: ${error.message}`);
          setSubmitting(false);
          return;
        }

        if (!meeting) {
          setError('Failed to create meeting: No data returned');
          setSubmitting(false);
          return;
        }

        await createTasks(meeting.id);
        fetchMeetings();
        resetForm();
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(`An unexpected error occurred: ${err.message || 'Unknown error'}`);
      setSubmitting(false);
    }
  };

  const createTasks = async (meetingId: string) => {
    const tasksToCreate = formData.tasks.filter(task => task.title.trim());
    if (tasksToCreate.length === 0) return;

    const tasks = tasksToCreate.map(task => ({
      meeting_id: meetingId,
      marketing_project_id: marketingProjectId,
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to,
      deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
      completed: false
    }));

    await supabase.from('tasks').insert(tasks);
  };

  const updateTasks = async (meetingId: string) => {
    const tasksWithContent = formData.tasks.filter(task => task.title.trim());

    const existingTaskIds = tasksWithContent.filter(t => t.id).map(t => t.id!);
    const newTasks = tasksWithContent.filter(t => !t.id);

    const { data: currentTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('meeting_id', meetingId);

    const currentTaskIds = currentTasks?.map(t => t.id) || [];
    const tasksToDelete = currentTaskIds.filter(id => !existingTaskIds.includes(id));

    if (tasksToDelete.length > 0) {
      await supabase
        .from('tasks')
        .delete()
        .in('id', tasksToDelete);
    }

    for (const task of tasksWithContent.filter(t => t.id)) {
      await supabase
        .from('tasks')
        .update({
          title: task.title,
          description: task.description,
          assigned_to: task.assigned_to,
          deadline: task.deadline ? new Date(task.deadline).toISOString() : null
        })
        .eq('id', task.id!);
    }

    if (newTasks.length > 0) {
      const tasks = newTasks.map(task => ({
        meeting_id: meetingId,
        marketing_project_id: marketingProjectId,
        title: task.title,
        description: task.description,
        assigned_to: task.assigned_to,
        deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
        completed: false
      }));

      await supabase.from('tasks').insert(tasks);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      meeting_date: '',
      location: '',
      attendees: [],
      attendeeInput: '',
      tasks: []
    });
    setShowModal(false);
    setEditingMeeting(null);
    setSubmitting(false);
    setError(null);
  };

  const handleEdit = async (meeting: Meeting) => {
    setEditingMeeting(meeting);

    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true });

    setFormData({
      title: meeting.title,
      description: meeting.description,
      meeting_date: toLocalDateTimeString(meeting.meeting_date),
      location: meeting.location,
      attendees: meeting.attendees,
      attendeeInput: '',
      tasks: existingTasks?.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        assigned_to: task.assigned_to,
        deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : null
      })) || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this meeting? All associated tasks will also be deleted.')) {
      const { error } = await supabase
        .from('marketing_meetings')
        .delete()
        .eq('id', id);

      if (!error) {
        fetchMeetings();
      }
    }
  };

  const toggleMeeting = (id: string) => {
    const newExpanded = new Set(expandedMeetings);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMeetings(newExpanded);
  };

  const toggleTaskComplete = async (task: MeetingTask) => {
    const newStatus = !task.completed;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('tasks')
      .update({
        completed: newStatus,
        completed_at: newStatus ? now : null,
        updated_at: now
      })
      .eq('id', task.id);

    if (!error) {
      fetchMeetingTasks(task.meeting_id);
    }
  };

  const handleDeleteTask = async (taskId: string, meetingId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (!error) {
        fetchMeetingTasks(meetingId);
      }
    }
  };

  const addAttendee = () => {
    if (formData.attendeeInput.trim()) {
      setFormData({
        ...formData,
        attendees: [...formData.attendees, formData.attendeeInput.trim()],
        attendeeInput: ''
      });
    }
  };

  const removeAttendee = (index: number) => {
    setFormData({
      ...formData,
      attendees: formData.attendees.filter((_, i) => i !== index)
    });
  };

  const addTask = () => {
    setFormData({
      ...formData,
      tasks: [...formData.tasks, { title: '', description: '', assigned_to: null, deadline: null }]
    });
  };

  const removeTask = (index: number) => {
    setFormData({
      ...formData,
      tasks: formData.tasks.filter((_, i) => i !== index)
    });
  };

  const updateTask = (index: number, field: string, value: any) => {
    const newTasks = [...formData.tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setFormData({ ...formData, tasks: newTasks });
  };

  const getTaskReminders = () => {
    const allTasks: MeetingTask[] = Object.values(meetingTasks).flat();
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const overdueTasks = allTasks.filter(
      task => !task.completed && task.deadline && new Date(task.deadline) < now
    );

    const upcomingTasks = allTasks.filter(
      task => !task.completed && task.deadline &&
      new Date(task.deadline) >= now && new Date(task.deadline) <= sevenDaysFromNow
    );

    return { overdueTasks, upcomingTasks };
  };

  const { overdueTasks, upcomingTasks } = getTaskReminders();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Meeting Records</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Meeting
        </button>
      </div>

      {(overdueTasks.length > 0 || upcomingTasks.length > 0) && (
        <div className="space-y-3">
          {overdueTasks.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Overdue Tasks ({overdueTasks.length})
              </h4>
              <div className="space-y-2">
                {overdueTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2 text-sm">
                    <button
                      onClick={() => toggleTaskComplete(task)}
                      className="mt-0.5 flex-shrink-0"
                    >
                      <Square className="w-4 h-4 text-red-600" />
                    </button>
                    <div className="flex-1">
                      <p className="text-red-900 font-medium">{task.title}</p>
                      <p className="text-red-700 text-xs mt-1">
                        Due: {new Date(task.deadline!).toLocaleDateString()}
                        {task.staff && ` • ${task.staff.full_name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingTasks.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Upcoming Tasks ({upcomingTasks.length})
              </h4>
              <div className="space-y-2">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2 text-sm">
                    <button
                      onClick={() => toggleTaskComplete(task)}
                      className="mt-0.5 flex-shrink-0"
                    >
                      <Square className="w-4 h-4 text-yellow-600" />
                    </button>
                    <div className="flex-1">
                      <p className="text-yellow-900 font-medium">{task.title}</p>
                      <p className="text-yellow-700 text-xs mt-1">
                        Due: {new Date(task.deadline!).toLocaleDateString()}
                        {task.staff && ` • ${task.staff.full_name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">No meetings recorded yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Meeting
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleMeeting(meeting.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2">{meeting.title}</h4>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(meeting.meeting_date).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {meeting.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {meeting.location}
                        </div>
                      )}
                      {meeting.attendees.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {meeting.attendees.length} attendees
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(meeting);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(meeting.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {expandedMeetings.has(meeting.id) && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {meeting.description && (
                    <div className="mb-4">
                      <h5 className="font-medium text-gray-900 mb-2">Description</h5>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{meeting.description}</p>
                    </div>
                  )}

                  {meeting.attendees.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-medium text-gray-900 mb-2">Attendees</h5>
                      <div className="flex flex-wrap gap-2">
                        {meeting.attendees.map((attendee, i) => (
                          <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                            {attendee}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Tasks</h5>
                    {meetingTasks[meeting.id]?.length > 0 ? (
                      <div className="space-y-2">
                        {meetingTasks[meeting.id].map((task) => (
                          <div
                            key={task.id}
                            className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                          >
                            <button
                              onClick={() => toggleTaskComplete(task)}
                              className="mt-0.5 flex-shrink-0"
                            >
                              {task.completed ? (
                                <CheckSquare className="w-5 h-5 text-green-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                                {task.staff && (
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {task.staff.full_name}
                                  </div>
                                )}
                                {task.deadline && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(task.deadline).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteTask(task.id, meeting.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No tasks created for this meeting</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingMeeting ? 'Edit Meeting' : 'New Meeting'}
              </h3>
              <button
                onClick={resetForm}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-900 mb-1">Error</h4>
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={formData.meeting_date}
                  onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Conference Room A, Zoom, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Meeting agenda, notes, or other details..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attendees
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={formData.attendeeInput}
                    onChange={(e) => setFormData({ ...formData, attendeeInput: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAttendee())}
                    placeholder="Enter attendee name and press Enter"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={addAttendee}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.attendees.map((attendee, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full flex items-center gap-2"
                    >
                      {attendee}
                      <button
                        type="button"
                        onClick={() => removeAttendee(i)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Tasks
                  </label>
                  <button
                    type="button"
                    onClick={addTask}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Task
                  </button>
                </div>
                  <div className="space-y-3">
                    {formData.tasks.map((task, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex items-start gap-2">
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => updateTask(index, 'title', e.target.value)}
                            placeholder="Task title"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => removeTask(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={task.description}
                          onChange={(e) => updateTask(index, 'description', e.target.value)}
                          placeholder="Task description (optional)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={task.assigned_to || ''}
                            onChange={(e) => updateTask(index, 'assigned_to', e.target.value || null)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Assign to...</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.full_name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={task.deadline || ''}
                            onChange={(e) => updateTask(index, 'deadline', e.target.value || null)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  {submitting ? 'Saving...' : (editingMeeting ? 'Update Meeting' : 'Create Meeting')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
