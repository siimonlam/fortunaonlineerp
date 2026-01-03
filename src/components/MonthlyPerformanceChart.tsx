import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, TrendingUp, DollarSign, MousePointer, Target, Users, User } from 'lucide-react';

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

interface DemographicData {
  age_group: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  results: number;
}

export default function MonthlyPerformanceChart({ accountId }: { accountId: string }) {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [allMonths, setAllMonths] = useState<MonthlyData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [demographics, setDemographics] = useState<DemographicData[]>([]);
  const [genderData, setGenderData] = useState<{ gender: string; spend: number; impressions: number; clicks: number; results: number }[]>([]);

  useEffect(() => {
    fetchMonthlyData();
  }, [accountId]);

  useEffect(() => {
    if (selectedMonth !== 'all') {
      fetchDemographicData(selectedMonth);
    } else {
      const months = data.map(d => d.month);
      if (months.length > 0) {
        fetchDemographicData(months);
      }
    }
  }, [selectedMonth, data]);

  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      const { data: insights, error } = await supabase
        .from('meta_monthly_insights')
        .select('*')
        .eq('account_id', accountId)
        .order('month_year', { ascending: true });

      if (error) throw error;

      const currentMonth = new Date().toISOString().slice(0, 7);

      const monthMap = new Map<string, MonthlyData>();

      (insights || []).forEach((insight: MonthlyInsight) => {
        const monthKey = insight.month_year.slice(0, 7);

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: formatMonthYear(monthKey),
            spend: 0,
            roas: 0,
            clicks: 0,
            cpc: 0,
            impressions: 0,
            results: 0,
            isCurrentMonth: monthKey === currentMonth
          });
        }

        const monthData = monthMap.get(monthKey)!;
        monthData.spend += Number(insight.spend) || 0;
        monthData.clicks += Number(insight.clicks) || 0;
        monthData.impressions += Number(insight.impressions) || 0;
        monthData.results += Number(insight.results) || 0;
      });

      const processedData = Array.from(monthMap.values()).map(data => ({
        ...data,
        cpc: data.clicks > 0 ? data.spend / data.clicks : 0,
        roas: data.spend > 0 ? (data.results * 100) / data.spend : 0
      }));

      setAllMonths(processedData);
      setData(processedData.slice(-6));

      if (selectedMonth === 'all' || !processedData.find(d => d.month === selectedMonth)) {
        setSelectedMonth('all');
      }
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDemographicData = async (months: string | string[]) => {
    try {
      let query = supabase
        .from('meta_monthly_demographics')
        .select('*')
        .eq('account_id', accountId);

      if (typeof months === 'string') {
        const monthYear = convertToMonthYear(months);
        query = query.like('month_year', `${monthYear}%`);
      } else {
        const monthYears = months.map(m => convertToMonthYear(m));
        const orConditions = monthYears.map(my => `month_year.like.${my}%`).join(',');
        query = query.or(orConditions);
      }

      const { data: demoData, error } = await query;

      if (error) throw error;

      setDemographics(demoData || []);

      const genderMap = new Map<string, { spend: number; impressions: number; clicks: number; results: number }>();

      (demoData || []).forEach((demo: any) => {
        const gender = demo.gender || 'unknown';
        if (!genderMap.has(gender)) {
          genderMap.set(gender, { spend: 0, impressions: 0, clicks: 0, results: 0 });
        }
        const genderStats = genderMap.get(gender)!;
        genderStats.spend += Number(demo.spend) || 0;
        genderStats.impressions += Number(demo.impressions) || 0;
        genderStats.clicks += Number(demo.clicks) || 0;
        genderStats.results += Number(demo.results) || 0;
      });

      const genderArray = Array.from(genderMap.entries()).map(([gender, stats]) => ({
        gender,
        ...stats
      })).sort((a, b) => b.spend - a.spend);

      setGenderData(genderArray);
    } catch (error) {
      console.error('Error fetching demographic data:', error);
    }
  };

  const convertToMonthYear = (monthStr: string): string => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = monthStr.split(' ');
    if (parts.length !== 2) return monthStr;

    const monthIndex = monthNames.indexOf(parts[0]);
    if (monthIndex === -1) return monthStr;

    const year = parts[1];
    const month = String(monthIndex + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const syncMonthlyData = async (preset: 'this_month' | 'last_6_months') => {
    setSyncing(true);
    try {
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
            datePreset: preset
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Sync error:', result);
        throw new Error(result.error || 'Failed to sync monthly data');
      }

      if (result.errors && result.errors.length > 0) {
        console.warn('Sync completed with errors:', result.errors);
        alert(`Sync completed with ${result.errors.length} errors. Check console for details.`);
      } else {
        alert(result.message || 'Monthly data synced successfully!');
      }

      await fetchMonthlyData();
    } catch (error: any) {
      console.error('Error syncing monthly data:', error);
      alert(`Failed to sync monthly data: ${error.message}`);
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
          onClick={() => syncMonthlyData('last_6_months')}
          disabled={syncing}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync Last 6 Months'}
        </button>
      </div>
    );
  }

  const displayData = selectedMonth === 'all' ? data : data.filter(d => d.month === selectedMonth);
  const statsData = selectedMonth === 'all' ? data : displayData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Monthly Performance</h3>
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Last 6 Months</option>
            {allMonths.slice(-12).map((month) => (
              <option key={month.month} value={month.month}>
                {month.month}
              </option>
            ))}
          </select>
          <button
            onClick={() => syncMonthlyData('this_month')}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync This Month'}
          </button>
          <button
            onClick={() => syncMonthlyData('last_6_months')}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Last 6 Months'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">{selectedMonth === 'all' ? 'Total' : 'Month'} Spend</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(statsData.reduce((sum, d) => sum + d.spend, 0))}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">{selectedMonth === 'all' ? 'Avg' : 'Month'} ROAS</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {statsData.length > 0
              ? (selectedMonth === 'all'
                  ? (statsData.reduce((sum, d) => sum + d.roas, 0) / statsData.length).toFixed(2)
                  : statsData[0].roas.toFixed(2))
              : '0.00'}x
          </p>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <MousePointer className="w-5 h-5" />
            <span className="text-sm font-medium">{selectedMonth === 'all' ? 'Total' : 'Month'} Clicks</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(statsData.reduce((sum, d) => sum + d.clicks, 0))}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <Target className="w-5 h-5" />
            <span className="text-sm font-medium">{selectedMonth === 'all' ? 'Avg' : 'Month'} CPC</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {(() => {
              const totalSpend = statsData.reduce((sum, d) => sum + d.spend, 0);
              const totalClicks = statsData.reduce((sum, d) => sum + d.clicks, 0);
              return formatCurrency(totalClicks > 0 ? totalSpend / totalClicks : 0);
            })()}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-sm font-medium text-gray-700 mb-4">
          {selectedMonth === 'all' ? 'Spend vs ROAS Comparison' : `${selectedMonth} - Spend vs ROAS`}
        </h4>
        <div className="space-y-6">
          {displayData.map((month, index) => (
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
              {displayData.map((month, index) => (
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
            {selectedMonth === 'all' && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Total / Average</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(statsData.reduce((sum, d) => sum + d.spend, 0))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {(statsData.reduce((sum, d) => sum + d.roas, 0) / statsData.length).toFixed(2)}x
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(statsData.reduce((sum, d) => sum + d.clicks, 0))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {(() => {
                      const totalSpend = statsData.reduce((sum, d) => sum + d.spend, 0);
                      const totalClicks = statsData.reduce((sum, d) => sum + d.clicks, 0);
                      return formatCurrency(totalClicks > 0 ? totalSpend / totalClicks : 0);
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(statsData.reduce((sum, d) => sum + d.impressions, 0))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(statsData.reduce((sum, d) => sum + d.results, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {genderData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h4 className="text-lg font-semibold text-gray-900">Gender Distribution</h4>
            </div>
            <div className="space-y-4">
              {genderData.map((item, index) => {
                const totalSpend = genderData.reduce((sum, g) => sum + g.spend, 0);
                const percentage = totalSpend > 0 ? (item.spend / totalSpend) * 100 : 0;
                const genderLabel = item.gender === 'male' ? 'Male' : item.gender === 'female' ? 'Female' : 'Unknown';
                const genderColor = item.gender === 'male' ? 'bg-blue-500' : item.gender === 'female' ? 'bg-pink-500' : 'bg-gray-500';

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className={`w-4 h-4 ${item.gender === 'male' ? 'text-blue-600' : item.gender === 'female' ? 'text-pink-600' : 'text-gray-600'}`} />
                        <span className="font-medium text-gray-700">{genderLabel}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatCurrency(item.spend)} ({percentage.toFixed(1)}%)
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className={`${genderColor} h-full rounded-full transition-all duration-500 flex items-center justify-center`}
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 15 && (
                          <span className="text-xs font-semibold text-white">{percentage.toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                      <div>Impressions: {formatNumber(item.impressions)}</div>
                      <div>Clicks: {formatNumber(item.clicks)}</div>
                      <div>Results: {formatNumber(item.results)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-purple-600" />
              <h4 className="text-lg font-semibold text-gray-900">Age Group Distribution</h4>
            </div>
            <div className="space-y-4">
              {(() => {
                const ageGroupMap = new Map<string, { spend: number; impressions: number; clicks: number; results: number }>();

                demographics.forEach((demo) => {
                  const age = demo.age_group || 'unknown';
                  if (!ageGroupMap.has(age)) {
                    ageGroupMap.set(age, { spend: 0, impressions: 0, clicks: 0, results: 0 });
                  }
                  const ageStats = ageGroupMap.get(age)!;
                  ageStats.spend += Number(demo.spend) || 0;
                  ageStats.impressions += Number(demo.impressions) || 0;
                  ageStats.clicks += Number(demo.clicks) || 0;
                  ageStats.results += Number(demo.results) || 0;
                });

                const ageArray = Array.from(ageGroupMap.entries())
                  .map(([age, stats]) => ({ age, ...stats }))
                  .sort((a, b) => {
                    if (a.age === 'unknown') return 1;
                    if (b.age === 'unknown') return -1;
                    const aNum = parseInt(a.age.split('-')[0]);
                    const bNum = parseInt(b.age.split('-')[0]);
                    return aNum - bNum;
                  });

                const totalSpend = ageArray.reduce((sum, item) => sum + item.spend, 0);

                return ageArray.map((item, index) => {
                  const percentage = totalSpend > 0 ? (item.spend / totalSpend) * 100 : 0;
                  const colorClass = [
                    'bg-purple-500',
                    'bg-indigo-500',
                    'bg-blue-500',
                    'bg-cyan-500',
                    'bg-teal-500',
                    'bg-emerald-500',
                    'bg-amber-500',
                    'bg-orange-500',
                    'bg-red-500',
                    'bg-gray-500'
                  ][index % 10];

                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">{item.age}</span>
                        <div className="text-sm text-gray-600">
                          {formatCurrency(item.spend)} ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                      <div className="bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className={`${colorClass} h-full rounded-full transition-all duration-500 flex items-center justify-center`}
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 15 && (
                            <span className="text-xs font-semibold text-white">{percentage.toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                        <div>Impressions: {formatNumber(item.impressions)}</div>
                        <div>Clicks: {formatNumber(item.clicks)}</div>
                        <div>Results: {formatNumber(item.results)}</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {demographics.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h4 className="text-lg font-semibold text-gray-900">Detailed Demographics Breakdown</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Age Group
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Spend
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Impressions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clicks
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reach
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Results
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CTR
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {demographics
                  .sort((a, b) => b.spend - a.spend)
                  .slice(0, 20)
                  .map((demo, index) => {
                    const ctr = demo.impressions > 0 ? (demo.clicks / demo.impressions * 100) : 0;
                    const genderLabel = demo.gender === 'male' ? 'Male' : demo.gender === 'female' ? 'Female' : 'Unknown';

                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {demo.age_group}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            demo.gender === 'male' ? 'bg-blue-100 text-blue-800' :
                            demo.gender === 'female' ? 'bg-pink-100 text-pink-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {genderLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(demo.spend)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatNumber(demo.impressions)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatNumber(demo.clicks)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatNumber(demo.reach)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatNumber(demo.results)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className={ctr >= 1 ? 'text-green-600 font-semibold' : 'text-gray-900'}>
                            {ctr.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {demographics.length > 20 && (
            <div className="px-6 py-3 bg-gray-50 text-sm text-gray-600 text-center">
              Showing top 20 of {demographics.length} demographic segments
            </div>
          )}
        </div>
      )}
    </div>
  );
}