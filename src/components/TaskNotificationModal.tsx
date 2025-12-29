import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, AlertCircle, CheckCircle2, Calendar, Trophy, Medal, Award } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  completed: boolean;
  project_id?: string;
  marketing_project_id?: string;
  assigned_to: string;
  project?: {
    title: string;
    company_name: string;
  };
  marketing_project?: {
    title: string;
    company_name: string;
  };
}

interface UserTaskStats {
  userId: string;
  fullName: string;
  pastDueCount: number;
  upcomingCount: number;
}

interface TaskNotificationModalProps {
  onClose: () => void;
}

export function TaskNotificationModal({ onClose }: TaskNotificationModalProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamStats, setTeamStats] = useState<UserTaskStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCleanupReminder, setShowCleanupReminder] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;

    setLoading(true);

    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('[TaskNotificationModal] Loading timeout - forcing close');
      setLoading(false);
      onClose();
    }, 10000); // 10 second timeout

    try {
      console.log('[TaskNotificationModal] Starting to load data...');
      await Promise.all([loadUserTasks(), loadTeamStats()]);
      console.log('[TaskNotificationModal] Data loaded successfully');
    } catch (error) {
      console.error('[TaskNotificationModal] Error loading data:', error);
      // Still close on error so user isn't blocked
      onClose();
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  async function loadUserTasks() {
    if (!user) return;

    console.log('[TaskNotificationModal] Loading user tasks for:', user.id);

    const [regularTasksRes, marketingTasksRes] = await Promise.all([
      supabase
        .from('tasks')
        .select(`
          *,
          project:projects(title, company_name)
        `)
        .eq('assigned_to', user.id)
        .eq('completed', false)
        .not('deadline', 'is', null),
      supabase
        .from('marketing_tasks')
        .select(`
          *,
          marketing_project:marketing_projects(title, company_name)
        `)
        .eq('assigned_to', user.id)
        .eq('completed', false)
        .not('deadline', 'is', null),
    ]);

    if (regularTasksRes.error) {
      console.error('[TaskNotificationModal] Error loading tasks:', regularTasksRes.error);
    }
    if (marketingTasksRes.error) {
      console.error('[TaskNotificationModal] Error loading marketing tasks:', marketingTasksRes.error);
    }

    const allTasks = [
      ...(regularTasksRes.data || []),
      ...(marketingTasksRes.data || []),
    ];

    console.log('[TaskNotificationModal] Loaded', allTasks.length, 'tasks');
    setTasks(allTasks);
  }

  async function loadTeamStats() {
    console.log('[TaskNotificationModal] Loading team stats...');

    const [staffRes, regularTasksRes, marketingTasksRes] = await Promise.all([
      supabase
        .from('staff')
        .select('id, full_name')
        .order('full_name'),
      supabase
        .from('tasks')
        .select('id, assigned_to, deadline, completed')
        .eq('completed', false)
        .not('deadline', 'is', null)
        .not('assigned_to', 'is', null),
      supabase
        .from('marketing_tasks')
        .select('id, assigned_to, deadline, completed')
        .eq('completed', false)
        .not('deadline', 'is', null)
        .not('assigned_to', 'is', null),
    ]);

    if (staffRes.error) {
      console.error('[TaskNotificationModal] Error loading staff:', staffRes.error);
    }
    if (regularTasksRes.error) {
      console.error('[TaskNotificationModal] Error loading all tasks:', regularTasksRes.error);
    }
    if (marketingTasksRes.error) {
      console.error('[TaskNotificationModal] Error loading all marketing tasks:', marketingTasksRes.error);
    }

    const staff = staffRes.data || [];
    const allTasks = [
      ...(regularTasksRes.data || []),
      ...(marketingTasksRes.data || []),
    ];

    console.log('[TaskNotificationModal] Loaded', staff.length, 'staff members and', allTasks.length, 'team tasks');

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const stats: UserTaskStats[] = staff.map(staffMember => {
      const userTasks = allTasks.filter(t => t.assigned_to === staffMember.id);

      const pastDue = userTasks.filter(task => {
        const deadline = new Date(task.deadline);
        deadline.setHours(0, 0, 0, 0);
        return deadline < now;
      }).length;

      const upcoming = userTasks.filter(task => {
        const deadline = new Date(task.deadline);
        deadline.setHours(0, 0, 0, 0);
        return deadline >= tomorrow;
      }).length;

      return {
        userId: staffMember.id,
        fullName: staffMember.full_name,
        pastDueCount: pastDue,
        upcomingCount: upcoming,
      };
    });

    const sortedStats = stats
      .filter(s => s.pastDueCount > 0 || s.upcomingCount > 0)
      .sort((a, b) => {
        if (b.pastDueCount !== a.pastDueCount) {
          return b.pastDueCount - a.pastDueCount;
        }
        return b.upcomingCount - a.upcomingCount;
      });

    console.log('[TaskNotificationModal] Computed stats for', sortedStats.length, 'staff with pending tasks');
    setTeamStats(sortedStats);
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const pastDueTasks = tasks.filter(task => {
    if (!task.deadline) return false;
    const deadline = new Date(task.deadline);
    deadline.setHours(0, 0, 0, 0);
    return deadline < now;
  });

  const dueTodayTasks = tasks.filter(task => {
    if (!task.deadline) return false;
    const deadline = new Date(task.deadline);
    deadline.setHours(0, 0, 0, 0);
    return deadline.getTime() === now.getTime();
  });

  const upcomingTasks = tasks.filter(task => {
    if (!task.deadline) return false;
    const deadline = new Date(task.deadline);
    deadline.setHours(0, 0, 0, 0);
    return deadline >= tomorrow;
  });

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading your tasks...</p>
          </div>
        </div>
      </div>
    );
  }

  const hasAnyTasks = tasks.length > 0;

  const handleOkClick = () => {
    if (pastDueTasks.length > 0 || dueTodayTasks.length > 0) {
      setShowCleanupReminder(true);
    } else {
      onClose();
    }
  };

  const handleCleanupReminderClose = () => {
    setShowCleanupReminder(false);
    onClose();
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 1:
        return <Medal className="w-6 h-6 text-slate-400" />;
      case 2:
        return <Award className="w-6 h-6 text-amber-700" />;
      default:
        return <div className="w-6 h-6 flex items-center justify-center text-sm font-bold text-slate-500">{index + 1}</div>;
    }
  };

  if (showCleanupReminder) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Don't Forget Your Tasks!
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              You have {pastDueTasks.length > 0 && `${pastDueTasks.length} past due task${pastDueTasks.length !== 1 ? 's' : ''}`}
              {pastDueTasks.length > 0 && dueTodayTasks.length > 0 && ' and '}
              {dueTodayTasks.length > 0 && `${dueTodayTasks.length} task${dueTodayTasks.length !== 1 ? 's' : ''} due today`}.
              Please take time to review and complete or reschedule your pending tasks.
            </p>
            <button
              onClick={handleCleanupReminderClose}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              I'll take care of it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              Your Task Summary
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {hasAnyTasks ? 'Here are your pending tasks' : 'You have no pending tasks with deadlines'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {hasAnyTasks && (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className={`text-3xl font-bold ${pastDueTasks.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {pastDueTasks.length}
                </div>
                <div className="text-xs text-slate-600 font-medium mt-1">Past Due</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${dueTodayTasks.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {dueTodayTasks.length}
                </div>
                <div className="text-xs text-slate-600 font-medium mt-1">Due Today</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${upcomingTasks.length > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                  {upcomingTasks.length}
                </div>
                <div className="text-xs text-slate-600 font-medium mt-1">Upcoming</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto p-6 border-r border-slate-200">
          {!hasAnyTasks ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">All Clear!</h3>
              <p className="text-slate-600">You have no pending tasks with deadlines at the moment.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pastDueTasks.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <h3 className="text-lg font-bold text-red-800">
                      Past Due ({pastDueTasks.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {pastDueTasks.map(task => {
                      const daysOverdue = Math.floor(
                        (now.getTime() - new Date(task.deadline!).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <div
                          key={task.id}
                          className="bg-white rounded-lg p-3 border border-red-200 shadow-sm"
                        >
                          <h4 className="font-semibold text-slate-800">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                          )}
                          {task.project && (
                            <p className="text-xs text-slate-500 mt-1">
                              Project: {task.project.company_name} - {task.project.title}
                            </p>
                          )}
                          {task.marketing_project && (
                            <p className="text-xs text-slate-500 mt-1">
                              Marketing: {task.marketing_project.company_name} - {task.marketing_project.title}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded">
                              {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                            </span>
                            <span className="text-xs text-slate-500">
                              Due: {new Date(task.deadline!).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {dueTodayTasks.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-5 h-5 text-amber-600" />
                    <h3 className="text-lg font-bold text-amber-800">
                      Due Today ({dueTodayTasks.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {dueTodayTasks.map(task => (
                      <div
                        key={task.id}
                        className="bg-white rounded-lg p-3 border border-amber-200 shadow-sm"
                      >
                        <h4 className="font-semibold text-slate-800">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}
                        {task.project && (
                          <p className="text-xs text-slate-500 mt-1">
                            Project: {task.project.company_name} - {task.project.title}
                          </p>
                        )}
                        {task.marketing_project && (
                          <p className="text-xs text-slate-500 mt-1">
                            Marketing: {task.marketing_project.company_name} - {task.marketing_project.title}
                          </p>
                        )}
                        <span className="inline-block text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded mt-2">
                          Due today
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {upcomingTasks.length > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-bold text-blue-800">
                      Upcoming ({upcomingTasks.length})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {upcomingTasks
                      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
                      .slice(0, 5)
                      .map(task => (
                        <div
                          key={task.id}
                          className="bg-white rounded-lg p-3 border border-blue-200 shadow-sm"
                        >
                          <h4 className="font-semibold text-slate-800">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                          )}
                          {task.project && (
                            <p className="text-xs text-slate-500 mt-1">
                              Project: {task.project.company_name} - {task.project.title}
                            </p>
                          )}
                          {task.marketing_project && (
                            <p className="text-xs text-slate-500 mt-1">
                              Marketing: {task.marketing_project.company_name} - {task.marketing_project.title}
                            </p>
                          )}
                          <span className="inline-block text-xs text-slate-600 mt-2">
                            Due: {new Date(task.deadline!).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    {upcomingTasks.length > 5 && (
                      <p className="text-sm text-slate-500 text-center pt-2">
                        +{upcomingTasks.length - 5} more upcoming tasks
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>

          <div className="w-80 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                <Trophy className="w-5 h-5 text-amber-500" />
                Team Leaderboard
              </h3>
              <p className="text-xs text-slate-500">Ranked by past due tasks</p>
            </div>

            {teamStats.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-sm text-slate-600">Everyone is on track!</p>
                <p className="text-xs text-slate-500 mt-1">No overdue tasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamStats.map((stat, index) => {
                  const isCurrentUser = stat.userId === user?.id;
                  return (
                    <div
                      key={stat.userId}
                      className={`rounded-lg p-3 transition-all ${
                        isCurrentUser
                          ? 'bg-blue-100 border-2 border-blue-300 shadow-md'
                          : 'bg-white border border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 pt-0.5">
                          {getRankIcon(index)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold text-sm truncate ${
                            isCurrentUser ? 'text-blue-900' : 'text-slate-900'
                          }`}>
                            {stat.fullName}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs font-normal text-blue-600">(You)</span>
                            )}
                          </h4>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                              <span className="text-xs font-bold text-red-600">
                                {stat.pastDueCount}
                              </span>
                              <span className="text-xs text-slate-500">past due</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-xs font-bold text-blue-600">
                                {stat.upcomingCount}
                              </span>
                              <span className="text-xs text-slate-500">upcoming</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleOkClick}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Got it, let's get started!
          </button>
        </div>
      </div>
    </div>
  );
}
