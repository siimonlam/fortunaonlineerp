import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Calendar, DollarSign, Eye, MousePointer, Target, BarChart3, RefreshCw } from 'lucide-react';

interface Campaign {
  campaign_id: string;
  name: string;
  objective: string;
  status: string;
}

interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  objective: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  cpc: number;
}

interface ObjectiveGroup {
  objective: string;
  campaigns: CampaignMetrics[];
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_results: number;
  avg_ctr: number;
  avg_cpc: number;
}

type DateRangeType = 'current_month' | 'last_30_days' | 'last_month' | 'custom';

export default function MetaCampaignPerformancePage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [objectiveGroups, setObjectiveGroups] = useState<ObjectiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('current_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [totalAdSets, setTotalAdSets] = useState(0);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchCampaignData();
    }
  }, [selectedAccount, dateRangeType, customStartDate, customEndDate]);

  const getDateRange = (): { since: string; until: string } => {
    const today = new Date();
    let since: Date;
    let until: Date;

    switch (dateRangeType) {
      case 'current_month':
        since = new Date(today.getFullYear(), today.getMonth(), 1);
        until = today;
        break;
      case 'last_30_days':
        since = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        until = today;
        break;
      case 'last_month':
        since = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        until = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'custom':
        since = customStartDate ? new Date(customStartDate) : new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        until = customEndDate ? new Date(customEndDate) : today;
        break;
      default:
        since = new Date(today.getFullYear(), today.getMonth(), 1);
        until = today;
    }

    return {
      since: since.toISOString().split('T')[0],
      until: until.toISOString().split('T')[0]
    };
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('meta_ad_accounts')
        .select('*')
        .order('account_name');

      if (error) throw error;

      setAccounts(data || []);
      if (data && data.length > 0) {
        setSelectedAccount(data[0].account_id);
      }
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignData = async () => {
    if (!selectedAccount) return;

    setLoading(true);
    try {
      const { since, until } = getDateRange();

      // Fetch campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('meta_campaigns')
        .select('campaign_id, name, objective, status')
        .eq('account_id', selectedAccount);

      if (campaignsError) throw campaignsError;

      if (!campaigns || campaigns.length === 0) {
        setObjectiveGroups([]);
        setTotalCampaigns(0);
        setTotalAdSets(0);
        return;
      }

      // Fetch ad sets count
      const { data: adsets } = await supabase
        .from('meta_adsets')
        .select('adset_id')
        .eq('account_id', selectedAccount);

      setTotalCampaigns(campaigns.length);
      setTotalAdSets(adsets?.length || 0);

      // Fetch insights for all campaigns in date range
      const { data: insights, error: insightsError } = await supabase
        .from('meta_ad_insights')
        .select('campaign_id, spend, impressions, clicks, cpc, ctr, results')
        .eq('account_id', selectedAccount)
        .gte('date', since)
        .lte('date', until);

      if (insightsError) throw insightsError;

      // Group metrics by campaign
      const campaignMetricsMap = new Map<string, CampaignMetrics>();

      campaigns.forEach((campaign: Campaign) => {
        const campaignInsights = insights?.filter(i => i.campaign_id === campaign.campaign_id) || [];

        const totalSpend = campaignInsights.reduce((sum, i) => sum + (parseFloat(i.spend as any) || 0), 0);
        const totalImpressions = campaignInsights.reduce((sum, i) => sum + (parseInt(i.impressions as any) || 0), 0);
        const totalClicks = campaignInsights.reduce((sum, i) => sum + (parseInt(i.clicks as any) || 0), 0);
        const totalResults = campaignInsights.reduce((sum, i) => sum + (parseInt(i.results as any) || 0), 0);

        const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

        campaignMetricsMap.set(campaign.campaign_id, {
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.name,
          objective: campaign.objective || 'UNKNOWN',
          status: campaign.status,
          spend: totalSpend,
          impressions: totalImpressions,
          clicks: totalClicks,
          results: totalResults,
          ctr: avgCtr,
          cpc: avgCpc
        });
      });

      // Group by objective
      const objectiveMap = new Map<string, CampaignMetrics[]>();

      campaignMetricsMap.forEach((metrics) => {
        const objective = metrics.objective;
        if (!objectiveMap.has(objective)) {
          objectiveMap.set(objective, []);
        }
        objectiveMap.get(objective)!.push(metrics);
      });

      // Calculate totals for each objective
      const groups: ObjectiveGroup[] = [];

      objectiveMap.forEach((campaigns, objective) => {
        const total_spend = campaigns.reduce((sum, c) => sum + c.spend, 0);
        const total_impressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
        const total_clicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
        const total_results = campaigns.reduce((sum, c) => sum + c.results, 0);
        const avg_ctr = total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0;
        const avg_cpc = total_clicks > 0 ? total_spend / total_clicks : 0;

        groups.push({
          objective,
          campaigns,
          total_spend,
          total_impressions,
          total_clicks,
          total_results,
          avg_ctr,
          avg_cpc
        });
      });

      // Sort by spend descending
      groups.sort((a, b) => b.total_spend - a.total_spend);

      setObjectiveGroups(groups);
    } catch (err: any) {
      console.error('Error fetching campaign data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncData = async () => {
    if (!selectedAccount) return;

    setSyncing(true);
    try {
      const { since, until } = getDateRange();

      const response = await supabase.functions.invoke('sync-meta-ads-insights', {
        body: {
          accountId: selectedAccount,
          dateRange: { since, until }
        }
      });

      if (response.error) throw response.error;

      await fetchCampaignData();
    } catch (err: any) {
      console.error('Error syncing data:', err);
      alert(`Error syncing data: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (value: number, currency: string = 'HKD') => {
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString();
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getObjectiveLabel = (objective: string) => {
    const labels: { [key: string]: string } = {
      'OUTCOME_TRAFFIC': 'OUTCOME TRAFFIC',
      'OUTCOME_SALES': 'OUTCOME SALES',
      'OUTCOME_ENGAGEMENT': 'OUTCOME ENGAGEMENT',
      'OUTCOME_LEADS': 'OUTCOME LEADS',
      'OUTCOME_AWARENESS': 'OUTCOME AWARENESS',
      'OUTCOME_APP_PROMOTION': 'OUTCOME APP PROMOTION'
    };
    return labels[objective] || objective;
  };

  const selectedAccountData = accounts.find(a => a.account_id === selectedAccount);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Meta Campaign Performance</h1>
        <p className="text-gray-600">Manage ad accounts and track campaign performance</p>
      </div>

      {/* Account Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <label className="font-medium text-gray-700">Select Account:</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {accounts.map((account) => (
              <option key={account.account_id} value={account.account_id}>
                {account.account_name || account.account_id} ({account.currency || 'HKD'})
              </option>
            ))}
          </select>
        </div>

        {selectedAccountData && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Account ID:</span>
                <span className="ml-2 font-mono">{selectedAccountData.account_id}</span>
              </div>
              <div>
                <span className="text-gray-600">Currency:</span>
                <span className="ml-2 font-semibold">{selectedAccountData.currency || 'HKD'}</span>
              </div>
              <div>
                <span className="text-gray-600">Business:</span>
                <span className="ml-2">{selectedAccountData.business_name || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Date Range Selection */}
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <label className="font-medium text-gray-700">View Data For:</label>
          <select
            value={dateRangeType}
            onChange={(e) => setDateRangeType(e.target.value as DateRangeType)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="current_month">Current Month (Month-to-Date)</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_month">Last Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {dateRangeType === 'custom' && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </>
          )}

          <button
            onClick={handleSyncData}
            disabled={syncing || !selectedAccount}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Monthly Reports'}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
          <div>
            <span className="font-semibold">{totalCampaigns}</span> campaigns
          </div>
          <div>
            <span className="font-semibold">{totalAdSets}</span> ad sets
          </div>
        </div>
      </div>

      {/* Campaign Data */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading campaign data...</p>
        </div>
      ) : objectiveGroups.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No campaign data found for the selected period</p>
          <p className="text-sm text-gray-500">Try syncing data or selecting a different date range</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-6 px-6">
              <button className="py-3 px-1 border-b-2 border-blue-600 text-blue-600 font-medium">
                Monthly Overview
              </button>
              <button className="py-3 px-1 text-gray-500 hover:text-gray-700">
                Campaigns
              </button>
              <button className="py-3 px-1 text-gray-500 hover:text-gray-700">
                Demographics
              </button>
              <button className="py-3 px-1 text-gray-500 hover:text-gray-700">
                Ad Sets
              </button>
              <button className="py-3 px-1 text-gray-500 hover:text-gray-700">
                Creative
              </button>
              <button className="py-3 px-1 text-gray-500 hover:text-gray-700">
                Platform
              </button>
              <button className="py-3 px-1 text-gray-500 hover:text-gray-700">
                Monthly Report
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Campaign / Objective
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
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
                    Results
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CTR
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPC
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {objectiveGroups.map((group, groupIndex) => (
                  <React.Fragment key={groupIndex}>
                    {/* Objective Header Row */}
                    <tr className="bg-blue-50">
                      <td className="px-6 py-3 font-bold text-blue-900 uppercase text-sm">
                        {getObjectiveLabel(group.objective)}
                      </td>
                      <td className="px-6 py-3"></td>
                      <td className="px-6 py-3 text-right font-bold text-blue-900">
                        {formatCurrency(group.total_spend, selectedAccountData?.currency)}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-blue-900">
                        {formatNumber(group.total_impressions)}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-blue-900">
                        {formatNumber(group.total_clicks)}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-blue-900">
                        {formatNumber(group.total_results)}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-blue-900">
                        {formatPercentage(group.avg_ctr)}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-blue-900">
                        {formatCurrency(group.avg_cpc, selectedAccountData?.currency)}
                      </td>
                    </tr>

                    {/* Campaign Rows */}
                    {group.campaigns.map((campaign, campaignIndex) => (
                      <tr key={campaignIndex} className="hover:bg-gray-50">
                        <td className="px-6 py-3 pl-12">
                          <div className="text-sm text-gray-900">{campaign.campaign_name}</div>
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              campaign.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-gray-900">
                          {formatCurrency(campaign.spend, selectedAccountData?.currency)}
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-gray-900">
                          {formatNumber(campaign.impressions)}
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-gray-900">
                          {formatNumber(campaign.clicks)}
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-gray-900">
                          {formatNumber(campaign.results)}
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-gray-900">
                          {formatPercentage(campaign.ctr)}
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-gray-900">
                          {formatCurrency(campaign.cpc, selectedAccountData?.currency)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
