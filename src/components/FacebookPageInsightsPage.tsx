import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Facebook, RefreshCw, TrendingUp, TrendingDown, Users, Eye, Heart, BarChart3, Globe, Smartphone, Calendar } from 'lucide-react';

interface FacebookAccount {
  page_id: string;
  name: string;
  followers_count: number;
  fan_count: number;
  total_reach_28d: number;
  total_engagement_28d: number;
  engagement_rate: number;
  net_growth_7d: number;
}

interface PageInsight {
  date: string;
  page_fans: number;
  page_fan_adds: number;
  page_fan_removes: number;
  net_growth: number;
  page_impressions_unique: number;
  page_impressions_organic: number;
  page_impressions_paid: number;
  page_post_engagements: number;
  page_engaged_users: number;
  engagement_rate: number;
}

interface Demographics {
  date: string;
  age_gender_breakdown: any;
  country_breakdown: any;
  device_breakdown: any;
}

export default function FacebookPageInsightsPage() {
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<FacebookAccount | null>(null);
  const [insights, setInsights] = useState<PageInsight[]>([]);
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(7);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchInsights(selectedAccount.page_id);
      fetchDemographics(selectedAccount.page_id);
    }
  }, [selectedAccount, dateRange]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('facebook_accounts')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async (pageId: string) => {
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - dateRange);

      const { data, error } = await supabase
        .from('facebook_page_insights')
        .select('*')
        .eq('page_id', pageId)
        .gte('date', daysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      setInsights(data || []);
    } catch (err: any) {
      console.error('Error fetching insights:', err);
    }
  };

  const fetchDemographics = async (pageId: string) => {
    try {
      const { data, error } = await supabase
        .from('facebook_page_demographics')
        .select('*')
        .eq('page_id', pageId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setDemographics(data);
    } catch (err: any) {
      console.error('Error fetching demographics:', err);
    }
  };

  const handleSyncInsights = async () => {
    if (!selectedAccount) return;

    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Calculate date range for sync (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      console.log('[FB Insights] Syncing insights for page:', selectedAccount.page_id);
      console.log('[FB Insights] Date range:', thirtyDaysAgo.toISOString().split('T')[0], 'to', yesterday.toISOString().split('T')[0]);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-facebook-page-insights`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pageId: selectedAccount.page_id,
            since: thirtyDaysAgo.toISOString().split('T')[0],
            until: yesterday.toISOString().split('T')[0],
          }),
        }
      );

      console.log('[FB Insights] Response status:', response.status);
      console.log('[FB Insights] Response content-type:', response.headers.get('content-type'));

      const contentType = response.headers.get('content-type');
      let result;

      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('[FB Insights] Non-JSON response:', text);
        throw new Error(`Expected JSON response but got: ${text.substring(0, 200)}`);
      }

      console.log('[FB Insights] Response data:', result);

      if (!response.ok) {
        console.error('[FB Insights] Error response:', result);
        throw new Error(result.error || result.details || JSON.stringify(result) || 'Failed to sync insights');
      }

      const summary = result.summary || {};
      setSuccessMessage(
        `Insights synced successfully! Stored ${result.insightsStored || 0} daily records. ` +
        `Net Growth (7d): ${summary.netGrowth7d || 0}, Reach (28d): ${summary.totalReach28d || 0}`
      );

      // Refresh the data
      await fetchAccounts();
      await fetchInsights(selectedAccount.page_id);
      await fetchDemographics(selectedAccount.page_id);
    } catch (err: any) {
      console.error('[FB Insights] Error syncing insights:', err);
      setError(err.message || 'Unknown error occurred. Check browser console for details.');
    } finally {
      setSyncing(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toLocaleString() || '0';
  };

  const getYesterdayData = () => {
    return insights[0] || null;
  };

  const get7DayTotals = () => {
    const last7Days = insights.slice(0, 7);
    return {
      reach: last7Days.reduce((sum, day) => sum + (day.page_impressions_unique || 0), 0),
      engagement: last7Days.reduce((sum, day) => sum + (day.page_post_engagements || 0), 0),
      netGrowth: last7Days.reduce((sum, day) => sum + (day.net_growth || 0), 0),
      engagedUsers: last7Days.reduce((sum, day) => sum + (day.page_engaged_users || 0), 0),
    };
  };

  const getTopAgeGender = () => {
    if (!demographics?.age_gender_breakdown) return [];
    const breakdown = demographics.age_gender_breakdown;
    return Object.entries(breakdown)
      .map(([key, value]) => ({ label: key, count: value as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const getTopCountries = () => {
    if (!demographics?.country_breakdown) return [];
    const breakdown = demographics.country_breakdown;
    return Object.entries(breakdown)
      .map(([key, value]) => ({ label: key, count: value as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const getDeviceBreakdown = () => {
    if (!demographics?.device_breakdown) return [];
    const breakdown = demographics.device_breakdown;
    return Object.entries(breakdown)
      .map(([key, value]) => ({ label: key, count: value as number }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <Facebook className="mx-auto text-gray-400 mb-4" size={48} />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Facebook Pages</h3>
        <p className="text-gray-600">Please sync Facebook pages first</p>
      </div>
    );
  }

  const yesterdayData = getYesterdayData();
  const totals = get7DayTotals();
  const engagementRate = totals.reach > 0 ? ((totals.engagedUsers / totals.reach) * 100).toFixed(2) : '0';

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <BarChart3 className="text-white" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Facebook Page Insights</h3>
            <p className="text-sm text-gray-600">Analytics and performance metrics</p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <select
            value={selectedAccount?.page_id || ''}
            onChange={(e) => {
              const account = accounts.find(a => a.page_id === e.target.value);
              setSelectedAccount(account || null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {accounts.map((account) => (
              <option key={account.page_id} value={account.page_id}>
                {account.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleSyncInsights}
            disabled={syncing || !selectedAccount}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? (
              <>
                <RefreshCw className="animate-spin" size={18} />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={18} />
                Sync Insights
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {insights.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <BarChart3 className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No insights data yet</h3>
          <p className="text-gray-600 mb-4">Click "Sync Insights" to fetch analytics data</p>
          <button
            onClick={handleSyncInsights}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <RefreshCw size={20} />
            Sync Insights
          </button>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Total Page Likes */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Total Page Likes</div>
                <Heart className="text-red-500" size={20} />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {formatNumber(selectedAccount?.fan_count || 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Current total likes</div>
            </div>

            {/* Net Growth (7-day) */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Net Growth (7-day)</div>
                {totals.netGrowth >= 0 ? (
                  <TrendingUp className="text-green-500" size={20} />
                ) : (
                  <TrendingDown className="text-red-500" size={20} />
                )}
              </div>
              <div className={`text-3xl font-bold ${totals.netGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totals.netGrowth >= 0 ? '+' : ''}{formatNumber(totals.netGrowth)}
              </div>
              <div className="text-xs text-gray-500 mt-1">New followers - Unfollows</div>
            </div>

            {/* Total Reach (7-day) */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Total Reach (7-day)</div>
                <Eye className="text-blue-500" size={20} />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {formatNumber(totals.reach)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Unique people reached</div>
            </div>

            {/* Engagement Rate */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Engagement Rate</div>
                <BarChart3 className="text-purple-500" size={20} />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {engagementRate}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Engaged / Reach</div>
            </div>

            {/* Total Engagement (7-day) */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Total Engagement (7-day)</div>
                <Heart className="text-pink-500" size={20} />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {formatNumber(totals.engagement)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Post engagements</div>
            </div>

            {/* Total Followers */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Total Followers</div>
                <Users className="text-indigo-500" size={20} />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {formatNumber(selectedAccount?.followers_count || 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Current followers</div>
            </div>
          </div>

          {/* Organic vs Paid Reach */}
          {yesterdayData && (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Yesterday's Reach Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatNumber(yesterdayData.page_impressions_organic || 0)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Organic Reach</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatNumber(yesterdayData.page_impressions_paid || 0)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Paid Reach</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatNumber(yesterdayData.page_impressions_unique || 0)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Total Reach</div>
                </div>
              </div>
            </div>
          )}

          {/* Demographics */}
          {demographics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Age & Gender */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="text-purple-500" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900">Age & Gender (Top 5)</h3>
                </div>
                <div className="space-y-3">
                  {getTopAgeGender().map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold text-sm">
                          {index + 1}
                        </div>
                        <span className="text-gray-700 font-medium">{item.label}</span>
                      </div>
                      <span className="text-gray-900 font-bold">{formatNumber(item.count)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Locations */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="text-blue-500" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900">Top Locations</h3>
                </div>
                <div className="space-y-3">
                  {getTopCountries().map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                          {index + 1}
                        </div>
                        <span className="text-gray-700 font-medium">{item.label}</span>
                      </div>
                      <span className="text-gray-900 font-bold">{formatNumber(item.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Device Breakdown */}
          {demographics && getDeviceBreakdown().length > 0 && (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="text-green-500" size={20} />
                <h3 className="text-lg font-semibold text-gray-900">Device Breakdown</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {getDeviceBreakdown().map((item, index) => (
                  <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatNumber(item.count)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1 capitalize">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Insights Table */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Daily Insights</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDateRange(7)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      dateRange === 7
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    7 Days
                  </button>
                  <button
                    onClick={() => setDateRange(30)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      dateRange === 30
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    30 Days
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reach
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organic
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Engagement
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Followers
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unfollows
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Net Growth
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {insights.map((insight, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(insight.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(insight.page_impressions_unique || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                        {formatNumber(insight.page_impressions_organic || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right">
                        {formatNumber(insight.page_impressions_paid || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(insight.page_post_engagements || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                        +{formatNumber(insight.page_fan_adds || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                        -{formatNumber(insight.page_fan_removes || 0)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                        (insight.net_growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(insight.net_growth || 0) >= 0 ? '+' : ''}{formatNumber(insight.net_growth || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
