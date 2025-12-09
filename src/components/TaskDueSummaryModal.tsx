import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Clock, X, CheckCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  project_id?: string;
  marketing_project_id?: string;
  project?: {
    title: string;
    company_name: string;
  };
  marketing_project?: {
    title: string;
    company_name: string;
  };
}

interface TaskDueSummaryModalProps {
  userId: string;
  onClose: () => void;
}

export function TaskDueSummaryModal({ userId, onClose }: TaskDueSummaryModalProps) {
  const [pastDueTasks, setPastDueTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [userId]);

  async function loadTasks() {
    setLoading(true);
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(startOfToday);
      endOfToday.setDate(endOfToday.getDate() + 1);

      const [tasksResult, marketingTasksResult] = await Promise.all([
        supabase
          .from('tasks')
          .select(`
            id,
            title,
            description,
            deadline,
            project_id,
            project:projects(title, company_name)
          `)
          .eq('assigned_to', userId)
          .eq('completed', false)
          .not('deadline', 'is', null)
          .order('deadline', { ascending: true }),
        supabase
          .from('marketing_tasks')
          .select(`
            id,
            title,
            description,
            deadline,
            marketing_project_id,
            marketing_project:marketing_projects(title, company_name)
          `)
          .eq('assigned_to', userId)
          .eq('completed', false)
          .not('deadline', 'is', null)
          .order('deadline', { ascending: true }),
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (marketingTasksResult.error) throw marketingTasksResult.error;

      const allTasks: Task[] = [
        ...(tasksResult.data || []),
        ...(marketingTasksResult.data || []),
      ];

      allTasks.sort((a, b) => {
        if (!a.deadline || !b.deadline) return 0;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });

      const pastDue: Task[] = [];
      const dueToday: Task[] = [];

      allTasks.forEach((task) => {
        if (task.deadline) {
          const deadlineDate = new Date(task.deadline);
          if (deadlineDate < startOfToday) {
            pastDue.push(task);
          } else if (deadlineDate >= startOfToday && deadlineDate < endOfToday) {
            dueToday.push(task);
          }
        }
      });

      setPastDueTasks(pastDue);
      setUpcomingTasks(dueToday);
    } catch (error) {
      console.error('Error loading task summary:', error);
    } finally {
      setLoading(false);
    }
  }

  const hasTasksToShow = pastDueTasks.length > 0 || upcomingTasks.length > 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          <p className="text-slate-600">Checking your tasks...</p>
        </div>
      </div>
    );
  }

  if (!hasTasksToShow) {
    return null;
  }

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    return `In ${diffDays} days`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-800">Task Summary</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {pastDueTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-semibold text-red-600">
                  Past Due ({pastDueTasks.length})
                </h3>
              </div>
              <div className="space-y-2">
                {pastDueTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-red-50 border border-red-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-800">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}
                        {task.project && (
                          <p className="text-sm text-slate-500 mt-2">
                            Project: {task.project.company_name} - {task.project.title}
                          </p>
                        )}
                        {task.marketing_project && (
                          <p className="text-sm text-slate-500 mt-2">
                            Marketing: {task.marketing_project.company_name} - {task.marketing_project.title}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {task.deadline && (
                          <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
                            {formatDeadline(task.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-semibold text-amber-600">
                  Due Today ({upcomingTasks.length})
                </h3>
              </div>
              <div className="space-y-2">
                {upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-800">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}
                        {task.project && (
                          <p className="text-sm text-slate-500 mt-2">
                            Project: {task.project.company_name} - {task.project.title}
                          </p>
                        )}
                        {task.marketing_project && (
                          <p className="text-sm text-slate-500 mt-2">
                            Marketing: {task.marketing_project.company_name} - {task.marketing_project.title}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {task.deadline && (
                          <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full">
                            Today
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle className="w-4 h-4" />
            <span>Stay on top of your tasks</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
