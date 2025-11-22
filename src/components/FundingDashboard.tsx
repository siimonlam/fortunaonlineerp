import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, AlertCircle, Clock } from 'lucide-react';

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

export function FundingDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalProjects, setTotalProjects] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const { data: statuses, error: statusError } = await supabase
        .from('statuses')
        .select('*')
        .eq('project_type_id', 'da2fb577-520e-4d0f-9e55-c1b7ecadee61')
        .order('order_index');

      if (statusError) throw statusError;

      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id, status_id, project_type_id')
        .eq('project_type_id', 'da2fb577-520e-4d0f-9e55-c1b7ecadee61');

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

        return {
          statusName: parentStatus.name,
          statusId: parentStatus.id,
          totalCount: parentCount,
          substatuses: children.map(child => ({
            name: child.name,
            count: statusCounts.get(child.id) || 0,
          })),
        };
      });

      setDashboardData(dashboardItems);
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
      </div>

      {dashboardData.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No status data available</p>
        </div>
      )}
    </div>
  );
}
