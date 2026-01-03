import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, TrendingUp, DollarSign, MousePointer, Target } from 'lucide-react';

interface MonthlyInsight {
  month_year: string;
  spend: number;
  purchase_roas: number;
  clicks: number;
  impressions: number;
  results: number;
}

interface MonthlyData {
  month: string;
  spend: number;
  roas: number;
  clicks: number;
  cpc: number;
  impressions: number;
  results: number;
  isCurrentMonth: boolean;
}

export default function MonthlyPerformanceChart({ accountId }: { accountId: string }) {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchMonthlyData();
  }, [accountId]);

  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      const { data: insights, error } = await supabase
        .from('meta_monthly_insights')
        .select('*')
        .eq('account_id', accountId)
        .eq('entity_level', 'campaign')
        .order('month_year', { ascending: true });

      if (error) throw error;

      const currentMonth = new Date().toISOString().slice(0, 7);

      const processedData = (insights || []).map((insight: MonthlyInsight) => ({
        month: formatMonthYear(insight.month_year),
        spend: insight.spend || 0,
        roas: insight.purchase_roas || 0,
        clicks: insight.clicks || 0,
        cpc: insight.clicks > 0 ? insight.spend / insight.clicks : 0,
        impressions: insight.impressions || 0,
        results: insight.results || 0,
        isCurrentMonth: insight.month_year === currentMonth
      }));

      setData(processedData.slice(-6));
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncCurrentMonth = async () => {
    setSyncing(true);
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = now;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-monthly-reports`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync monthly data');
      }

      await fetchMonthlyData();
    } catch (error) {
      console.error('Error syncing monthly data:', error);
      alert('Failed to sync monthly data. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const formatMonthYear = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `HK$${amount.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const maxSpend = Math.max(...data.map(d => d.spend), 1);
  const maxRoas = Math.max(...data.map(d => d.roas), 1);

  const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);
  const avgRoas = data.length > 0 ? data.reduce((sum, d) => sum + d.roas, 0) / data.length : 0;
  const totalClicks = data.reduce((sum, d) => sum + d.clicks, 0);
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 mb-4">No monthly data available</p>
        <button
          onClick={syncCurrentMonth}
          disabled={syncing}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync Current Month'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Monthly Performance (Last 6 Months)</h3>
        <button
          onClick={syncCurrentMonth}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Current Month'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">Total Spend</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSpend)}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Avg ROAS</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgRoas.toFixed(2)}x</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <MousePointer className="w-5 h-5" />
            <span className="text-sm font-medium">Total Clicks</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(totalClicks)}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <Target className="w-5 h-5" />
            <span className="text-sm font-medium">Avg CPC</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(avgCpc)}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Spend vs ROAS Comparison</h4>
        <div className="space-y-6">
          {data.map((month, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">
                  {month.month}
                  {month.isCurrentMonth && <span className="ml-2 text-xs text-blue-600 font-semibold">(MTD)</span>}
                </span>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span>Spend: {formatCurrency(month.spend)}</span>
                  <span>ROAS: {month.roas.toFixed(2)}x</span>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                    <span className="text-xs text-gray-500">Spend</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${(month.spend / maxSpend) * 100}%` }}
                    >
                      {month.spend > maxSpend * 0.2 && (
                        <span className="text-xs font-semibold text-white">{formatCurrency(month.spend)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                    <span className="text-xs text-gray-500">ROAS</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-green-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${(month.roas / maxRoas) * 100}%` }}
                    >
                      {month.roas > maxRoas * 0.2 && (
                        <span className="text-xs font-semibold text-white">{month.roas.toFixed(2)}x</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Month
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spend
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ROAS
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clicks
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPC
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Impressions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Results
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((month, index) => (
                <tr key={index} className={month.isCurrentMonth ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {month.month}
                    {month.isCurrentMonth && (
                      <span className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded">MTD</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(month.spend)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span className={month.roas >= 2 ? 'text-green-600 font-semibold' : 'text-gray-900'}>
                      {month.roas.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(month.clicks)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(month.cpc)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(month.impressions)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(month.results)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Total / Average</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(totalSpend)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {avgRoas.toFixed(2)}x
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatNumber(totalClicks)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(avgCpc)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatNumber(data.reduce((sum, d) => sum + d.impressions, 0))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatNumber(data.reduce((sum, d) => sum + d.results, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}