import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, AlertCircle, Clock, Calendar } from 'lucide-react';

interface Status {
  id: string;
  name: string;
  order_index: number;
  parent_status_id: string | null;
  is_substatus: boolean;
}

interface StatusCount {
  status_id: string;
  count: number;
}

interface DashboardData {
  statusName: string;
  statusId: string;
  totalCount: number;
  substatuses: {
    name: string;
    count: number;
  }[];
}

interface Project {
  id: string;
  title: string;
  project_end_date: string | null;
  status_id: string;
  submission_date: string | null;
}

export function FundingDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalProjects, setTotalProjects] = useState(0);
  const [activeTab, setActiveTab] = useState<'summary' | 'progress'>('summary');
  const [endingSoonProjects, setEndingSoonProjects] = useState<Project[]>([]);
  const [selectedMonths, setSelectedMonths] = useState(4);
  const [agingProjects, setAgingProjects] = useState<Project[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    filterAgingProjects();
  }, [selectedMonths, totalProjects]);

  const filterAgingProjects = async () => {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id, title, submission_date, status_id, project_end_date')
        .eq('project_type_id', '49c17e80-db14-4e13-b03f-537771270696');

      if (error) throw error;

      const currentDate = new Date();
      const monthsInMs = selectedMonths * 30 * 24 * 60 * 60 * 1000;

      const filtered = projects?.filter(p => {
        if (!p.submission_date) return false;
        const submissionDate = new Date(p.submission_date);
        const daysDiff = (currentDate.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24);
        const monthsDiff = daysDiff / 30;
        return monthsDiff >= selectedMonths;
      }) || [];

      setAgingProjects(filtered as Project[]);
    } catch (error) {
      console.error('Error filtering aging projects:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const { data: statuses, error: statusError } = await supabase
        .from('statuses')
        .select('*')
        .eq('project_type_id', '49c17e80-db14-4e13-b03f-537771270696')
        .order('order_index');

      if (statusError) throw statusError;

      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id, status_id, project_type_id, title, project_end_date, submission_date')
        .eq('project_type_id', '49c17e80-db14-4e13-b03f-537771270696');

      if (projectError) throw projectError;

      setTotalProjects(projects?.length || 0);

      const parentStatuses = statuses?.filter(s => !s.is_substatus) || [];
      const childStatuses = statuses?.filter(s => s.is_substatus) || [];

      const statusCounts = new Map<string, number>();
      projects?.forEach(project => {
        const count = statusCounts.get(project.status_id) || 0;
        statusCounts.set(project.status_id, count + 1);
      });

      const dashboardItems: DashboardData[] = parentStatuses.map(parentStatus => {
        const children = childStatuses.filter(s => s.parent_status_id === parentStatus.id);
        const parentCount = statusCounts.get(parentStatus.id) || 0;

        const substatusData = children.map(child => ({
          name: child.name,
          count: statusCounts.get(child.id) || 0,
        }));

        const substatusTotal = substatusData.reduce((sum, sub) => sum + sub.count, 0);
        const totalCount = parentCount + substatusTotal;

        return {
          statusName: parentStatus.name,
          statusId: parentStatus.id,
          totalCount: totalCount,
          substatuses: substatusData,
        };
      });

      setDashboardData(dashboardItems);

      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

      const projectsEndingSoon = projects?.filter(p => {
        if (!p.project_end_date) return false;
        const endDate = new Date(p.project_end_date);
        const now = new Date();
        return endDate >= now && endDate <= threeMonthsFromNow;
      }) || [];

      setEndingSoonProjects(projectsEndingSoon as Project[]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full bg-slate-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Funding Projects Dashboard</h1>
            <p className="text-blue-100">Overview of all funding project statuses</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold">{totalProjects}</div>
            <div className="text-blue-100 text-sm font-medium">Total Projects</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'summary'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Project Summary
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'progress'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Progress
        </button>
      </div>

      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dashboardData.map((item) => (
          <div
            key={item.statusId}
            className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 rounded-lg p-2">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">{item.statusName}</h2>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{item.totalCount}</div>
                  <div className="text-xs text-slate-500 font-medium">projects</div>
                </div>
              </div>
            </div>

            {item.substatuses.length > 0 ? (
              <div className="p-4">
                <div className="space-y-2">
                  {item.substatuses.map((substatus, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        <span className="text-sm font-medium text-slate-700">{substatus.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-800">{substatus.count}</span>
                        <span className="text-xs text-slate-500">projects</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="text-center py-6 text-slate-400 text-sm">
                  No substatuses
                </div>
              </div>
            )}
          </div>
        ))}

        {dashboardData.length === 0 && (
          <div className="col-span-full text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No status data available</p>
          </div>
        )}
      </div>
      )}

      {activeTab === 'progress' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-amber-600 rounded-lg p-2">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Submission Aging Analysis</h2>
                  <p className="text-sm text-slate-600">Projects by time since submission</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">Filter by:</label>
                <select
                  value={selectedMonths}
                  onChange={(e) => setSelectedMonths(Number(e.target.value))}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={4}>More than 4 months</option>
                  <option value={5}>More than 5 months</option>
                  <option value={6}>More than 6 months</option>
                  <option value={7}>More than 7 months</option>
                  <option value={8}>More than 8 months</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex items-center justify-center py-8">
                <div className="relative">
                  <svg className="w-48 h-48 transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      stroke="#e2e8f0"
                      strokeWidth="16"
                      fill="none"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      stroke="#d97706"
                      strokeWidth="16"
                      fill="none"
                      strokeDasharray={`${totalProjects > 0 ? (agingProjects.length / totalProjects) * 502.4 : 0} 502.4`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-amber-600">{agingProjects.length}</div>
                      <div className="text-sm text-slate-600 font-medium">projects</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {agingProjects.length > 0 ? (
                  agingProjects.map((project) => {
                    const submissionDate = project.submission_date ? new Date(project.submission_date) : null;
                    const currentDate = new Date();
                    const daysDiff = submissionDate
                      ? Math.floor((currentDate.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24))
                      : 0;

                    return (
                      <div
                        key={project.id}
                        className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{project.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <p className="text-xs text-slate-600">
                                Submitted: {submissionDate
                                  ? submissionDate.toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'No date'}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                              {daysDiff} days
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No projects older than {selectedMonths} months</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-600 rounded-lg p-2">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Projects Ending Soon</h2>
                  <p className="text-sm text-slate-600">Within 3 months</p>
                </div>
              </div>

            <div className="flex items-center justify-center py-8">
              <div className="relative">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="#e2e8f0"
                    strokeWidth="16"
                    fill="none"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="#ea580c"
                    strokeWidth="16"
                    fill="none"
                    strokeDasharray={`${(endingSoonProjects.length / totalProjects) * 502.4} 502.4`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-orange-600">{endingSoonProjects.length}</div>
                    <div className="text-sm text-slate-600 font-medium">projects</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-slate-600">
              <span className="font-semibold">{Math.round((endingSoonProjects.length / totalProjects) * 100) || 0}%</span> of total projects
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-600 rounded-lg p-2">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Project List</h2>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {endingSoonProjects.length > 0 ? (
                endingSoonProjects.map((project) => (
                  <div
                    key={project.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{project.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <p className="text-xs text-slate-600">
                            {project.project_end_date
                              ? new Date(project.project_end_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'No end date'}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full border border-orange-200">
                          {project.project_end_date
                            ? Math.ceil(
                                (new Date(project.project_end_date).getTime() - new Date().getTime()) /
                                  (1000 * 60 * 60 * 24)
                              )
                            : 0}{' '}
                          days
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No projects ending within 3 months</p>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
