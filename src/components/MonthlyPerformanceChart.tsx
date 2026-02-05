import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, TrendingUp, DollarSign, MousePointer, Target, Users, User, ArrowUpDown, ArrowUp, ArrowDown, Copy, Download } from 'lucide-react';

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

interface Props {
  accountId: string;
  selectedMonth: string;
}

type SortColumn = 'month' | 'spend' | 'roas' | 'clicks' | 'cpc' | 'impressions' | 'results';
type SortDirection = 'asc' | 'desc' | null;

export default function MonthlyPerformanceChart({ accountId, selectedMonth }: Props) {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [allMonths, setAllMonths] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [demographics, setDemographics] = useState<DemographicData[]>([]);
  const [genderData, setGenderData] = useState<{ gender: string; spend: number; impressions: number; clicks: number; results: number }[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [copiedColumn, setCopiedColumn] = useState<string | null>(null);

  useEffect(() => {
    fetchMonthlyData();
  }, [accountId]);

  useEffect(() => {
    if (data.length > 0) {
      const monthToFetch = convertMonthFormatToDisplayFormat(selectedMonth);
      const monthExists = data.find(d => d.month === monthToFetch);

      if (monthExists) {
        fetchDemographicData(monthToFetch);
      } else {
        const months = data.map(d => d.month);
        if (months.length > 0) {
          fetchDemographicData(months);
        }
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

  const convertMonthFormatToDisplayFormat = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `HK$${amount.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedData = (dataToSort: MonthlyData[]): MonthlyData[] => {
    if (!sortColumn || !sortDirection) {
      return dataToSort;
    }

    return [...dataToSort].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'month':
          aValue = a.month;
          bValue = b.month;
          break;
        case 'spend':
          aValue = a.spend;
          bValue = b.spend;
          break;
        case 'roas':
          aValue = a.roas;
          bValue = b.roas;
          break;
        case 'clicks':
          aValue = a.clicks;
          bValue = b.clicks;
          break;
        case 'cpc':
          aValue = a.cpc;
          bValue = b.cpc;
          break;
        case 'impressions':
          aValue = a.impressions;
          bValue = b.impressions;
          break;
        case 'results':
          aValue = a.results;
          bValue = b.results;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  const copyColumnData = (column: SortColumn, dataToExport: MonthlyData[]) => {
    let columnData: string[] = [];

    switch (column) {
      case 'month':
        columnData = dataToExport.map(d => d.month);
        break;
      case 'spend':
        columnData = dataToExport.map(d => formatCurrency(d.spend));
        break;
      case 'roas':
        columnData = dataToExport.map(d => `${d.roas.toFixed(2)}x`);
        break;
      case 'clicks':
        columnData = dataToExport.map(d => formatNumber(d.clicks));
        break;
      case 'cpc':
        columnData = dataToExport.map(d => formatCurrency(d.cpc));
        break;
      case 'impressions':
        columnData = dataToExport.map(d => formatNumber(d.impressions));
        break;
      case 'results':
        columnData = dataToExport.map(d => formatNumber(d.results));
        break;
    }

    const text = columnData.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedColumn(column);
    setTimeout(() => setCopiedColumn(null), 2000);
  };

  const exportToCSV = (dataToExport: MonthlyData[]) => {
    const headers = ['Month', 'Spend', 'ROAS', 'Clicks', 'CPC', 'Impressions', 'Results'];
    const rows = dataToExport.map(d => [
      d.month,
      d.spend.toFixed(2),
      d.roas.toFixed(2),
      d.clicks.toString(),
      d.cpc.toFixed(2),
      d.impressions.toString(),
      d.results.toString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-performance-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
        <p className="text-gray-600">No monthly data available</p>
        <p className="text-sm text-gray-500 mt-2">Use "Sync Monthly Reports" button above to fetch data</p>
      </div>
    );
  }

  let displayData: MonthlyData[] = [];
  let statsData: MonthlyData[] = [];

  if (selectedMonth === 'last_6_months' || selectedMonth === 'last_12_months') {
    const monthCount = selectedMonth === 'last_6_months' ? 6 : 12;
    displayData = allMonths.slice(-monthCount);
    statsData = displayData;
  } else {
    const displayMonth = convertMonthFormatToDisplayFormat(selectedMonth);
    displayData = data.filter(d => d.month === displayMonth);
    statsData = displayData.length > 0 ? displayData : data.slice(-6);
  }

  const sortedDisplayData = getSortedData(displayData);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Monthly Performance</h3>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">Month Spend</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(statsData.reduce((sum, d) => sum + d.spend, 0))}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Month ROAS</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {statsData.length > 0 && statsData[0].roas ? statsData[0].roas.toFixed(2) : '0.00'}x
          </p>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <MousePointer className="w-5 h-5" />
            <span className="text-sm font-medium">Month Clicks</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(statsData.reduce((sum, d) => sum + d.clicks, 0))}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <Target className="w-5 h-5" />
            <span className="text-sm font-medium">Month CPC</span>
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
          {(() => {
            if (selectedMonth === 'last_6_months') return 'Last 6 Months - Spend vs ROAS Comparison';
            if (selectedMonth === 'last_12_months') return 'Last 12 Months - Spend vs ROAS Comparison';
            return displayData.length === 1 ? `${displayData[0].month} - Spend vs ROAS` : 'Spend vs ROAS Comparison';
          })()}
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
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">Monthly Data Table</h4>
          <button
            onClick={() => exportToCSV(sortedDisplayData)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2 group">
                    <button
                      onClick={() => handleSort('month')}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Month
                      {sortColumn === 'month' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                      )}
                    </button>
                    <button
                      onClick={() => copyColumnData('month', sortedDisplayData)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy column"
                    >
                      <Copy className={`w-3 h-3 ${copiedColumn === 'month' ? 'text-green-600' : 'text-gray-500'}`} />
                    </button>
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2 group">
                    <button
                      onClick={() => copyColumnData('spend', sortedDisplayData)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy column"
                    >
                      <Copy className={`w-3 h-3 ${copiedColumn === 'spend' ? 'text-green-600' : 'text-gray-500'}`} />
                    </button>
                    <button
                      onClick={() => handleSort('spend')}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Spend
                      {sortColumn === 'spend' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                      )}
                    </button>
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2 group">
                    <button
                      onClick={() => copyColumnData('roas', sortedDisplayData)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy column"
                    >
                      <Copy className={`w-3 h-3 ${copiedColumn === 'roas' ? 'text-green-600' : 'text-gray-500'}`} />
                    </button>
                    <button
                      onClick={() => handleSort('roas')}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      ROAS
                      {sortColumn === 'roas' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                      )}
                    </button>
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2 group">
                    <button
                      onClick={() => copyColumnData('clicks', sortedDisplayData)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy column"
                    >
                      <Copy className={`w-3 h-3 ${copiedColumn === 'clicks' ? 'text-green-600' : 'text-gray-500'}`} />
                    </button>
                    <button
                      onClick={() => handleSort('clicks')}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Clicks
                      {sortColumn === 'clicks' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                      )}
                    </button>
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2 group">
                    <button
                      onClick={() => copyColumnData('cpc', sortedDisplayData)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy column"
                    >
                      <Copy className={`w-3 h-3 ${copiedColumn === 'cpc' ? 'text-green-600' : 'text-gray-500'}`} />
                    </button>
                    <button
                      onClick={() => handleSort('cpc')}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      CPC
                      {sortColumn === 'cpc' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                      )}
                    </button>
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2 group">
                    <button
                      onClick={() => copyColumnData('impressions', sortedDisplayData)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy column"
                    >
                      <Copy className={`w-3 h-3 ${copiedColumn === 'impressions' ? 'text-green-600' : 'text-gray-500'}`} />
                    </button>
                    <button
                      onClick={() => handleSort('impressions')}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Impressions
                      {sortColumn === 'impressions' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                      )}
                    </button>
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2 group">
                    <button
                      onClick={() => copyColumnData('results', sortedDisplayData)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy column"
                    >
                      <Copy className={`w-3 h-3 ${copiedColumn === 'results' ? 'text-green-600' : 'text-gray-500'}`} />
                    </button>
                    <button
                      onClick={() => handleSort('results')}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      Results
                      {sortColumn === 'results' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                      )}
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDisplayData.map((month, index) => (
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