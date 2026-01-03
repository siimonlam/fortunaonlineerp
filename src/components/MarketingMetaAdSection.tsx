import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, Plus, RefreshCw, Trash2, ExternalLink, TrendingUp, DollarSign, Eye, MousePointer, Filter, ChevronDown, Calendar } from 'lucide-react';
import MonthlyPerformanceChart from './MonthlyPerformanceChart';

interface MarketingMetaAdSectionProps {
  projectId: string;
  clientNumber: string | null;
}

interface MetaAdAccount {
  account_id: string;
  account_name: string;
  currency: string;
  account_status: number;
  business_name: string;
}

interface LinkedAccount {
  id: string;
  account_id: string;
  meta_ad_accounts: MetaAdAccount;
}

interface CampaignMetrics {
  campaign_id: string;
  name: string;
  status: string;
  objective: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_results: number;
  avg_ctr: number;
  avg_cpc: number;
}

interface DemographicBreakdown {
  age: string;
  gender: string;
  country: string;
  impressions: number;
  clicks: number;
  spend: number;
  results: number;
}

interface AdSetMetrics {
  adset_id: string;
  name: string;
  status: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_results: number;
}

interface AdCreativeMetrics {
  ad_id: string;
  name: string;
  status: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_results: number;
}

export default function MarketingMetaAdSection({ projectId, clientNumber }: MarketingMetaAdSectionProps) {
  const [availableAccounts, setAvailableAccounts] = useState<MetaAdAccount[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [demographics, setDemographics] = useState<DemographicBreakdown[]>([]);
  const [adSets, setAdSets] = useState<AdSetMetrics[]>([]);
  const [ads, setAds] = useState<AdCreativeMetrics[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [reportView, setReportView] = useState<'monthly' | 'campaigns' | 'demographics' | 'adsets' | 'ads'>('monthly');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showMonthlyReportModal, setShowMonthlyReportModal] = useState(false);
  const [monthlyReportResults, setMonthlyReportResults] = useState<any>(null);
  const [syncingMonthly, setSyncingMonthly] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [demographicView, setDemographicView] = useState<'age' | 'gender' | 'all'>('age');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedAccountForView, setSelectedAccountForView] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    if (selectedAccountForView) {
      loadCampaignMetrics(selectedAccountForView);
    }
  }, [selectedMonth, selectedAccountForView]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [accountsRes, linkedRes] = await Promise.all([
        supabase.from('meta_ad_accounts').select('*'),
        supabase
          .from('marketing_meta_ad_accounts')
          .select('*, meta_ad_accounts(*)')
          .eq('marketing_project_id', projectId)
      ]);

      if (accountsRes.data) setAvailableAccounts(accountsRes.data);
      if (linkedRes.data) {
        setLinkedAccounts(linkedRes.data as LinkedAccount[]);

        const accountIds = linkedRes.data.map((l: any) => l.account_id);
        if (accountIds.length > 0) {
          if (!selectedAccountForView && accountIds.length > 0) {
            setSelectedAccountForView(accountIds[0]);
          }
          loadAvailableMonths(accountIds);
          loadCampaignMetrics(selectedAccountForView || accountIds[0]);
        }
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableMonths = async (accountIds: string[]) => {
    try {
      const { data } = await supabase
        .from('meta_monthly_insights')
        .select('month_year')
        .in('account_id', accountIds)
        .order('month_year', { ascending: false });

      if (data) {
        const uniqueMonths = Array.from(new Set(data.map(d => {
          const date = new Date(d.month_year);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        })));
        setAvailableMonths(uniqueMonths);
      }
    } catch (err: any) {
      console.error('Error loading available months:', err);
    }
  };

  const loadCampaignMetrics = async (accountId: string) => {
    try {
      // Parse selected month
      const [year, month] = selectedMonth.split('-');
      const monthStart = `${year}-${month}-01`;

      // Query monthly insights for the selected month
      const { data: monthlyData } = await supabase
        .from('meta_monthly_insights')
        .select('*')
        .eq('account_id', accountId)
        .gte('month_year', monthStart)
        .lt('month_year', `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`);

      if (!monthlyData || monthlyData.length === 0) {
        setCampaigns([]);
        setAdSets([]);
        setAds([]);
        setDemographics([]);
        return;
      }

      // Aggregate by campaign
      const campaignMap = new Map<string, any>();

      monthlyData.forEach((insight) => {
        if (!insight.campaign_id) return;

        if (!campaignMap.has(insight.campaign_id)) {
          campaignMap.set(insight.campaign_id, {
            campaign_id: insight.campaign_id,
            name: insight.campaign_name,
            account_id: insight.account_id,
            status: 'ACTIVE',
            objective: '',
            total_spend: 0,
            total_impressions: 0,
            total_clicks: 0,
            total_conversions: 0,
            total_results: 0,
            avg_ctr: 0,
            avg_cpc: 0,
            count: 0
          });
        }

        const campaign = campaignMap.get(insight.campaign_id);
        campaign.total_spend += Number(insight.spend) || 0;
        campaign.total_impressions += Number(insight.impressions) || 0;
        campaign.total_clicks += Number(insight.clicks) || 0;
        campaign.total_conversions += Number(insight.conversions) || 0;
        campaign.total_results += Number(insight.results) || 0;
        campaign.avg_ctr += Number(insight.ctr) || 0;
        campaign.avg_cpc += Number(insight.cpc) || 0;
        campaign.count += 1;
      });

      const metrics = Array.from(campaignMap.values()).map(campaign => ({
        ...campaign,
        avg_ctr: campaign.count > 0 ? campaign.avg_ctr / campaign.count : 0,
        avg_cpc: campaign.count > 0 ? campaign.avg_cpc / campaign.count : 0
      }));

      setCampaigns(metrics);

      if (metrics.length > 0) {
        loadAdSets(monthlyData);
      }

      loadDemographics(accountId);
    } catch (err: any) {
      console.error('Error loading campaign metrics:', err);
    }
  };

  const loadDemographics = async (accountId: string) => {
    try {
      const [year, month] = selectedMonth.split('-');
      const monthStart = `${year}-${month}-01`;

      const { data: demographics } = await supabase
        .from('meta_monthly_demographics')
        .select('age_group, gender, country, impressions, clicks, spend, reach, results, conversions')
        .eq('account_id', accountId)
        .gte('month_year', monthStart)
        .lt('month_year', `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`);

      if (!demographics || demographics.length === 0) {
        setDemographics([]);
        return;
      }

      const aggregated = demographics.reduce((acc: any, demo: any) => {
        const key = `${demo.age_group || 'unknown'}_${demo.gender || 'unknown'}_${demo.country || 'unknown'}`;
        if (!acc[key]) {
          acc[key] = {
            age: demo.age_group || 'Unknown',
            gender: demo.gender || 'Unknown',
            country: demo.country || 'Unknown',
            impressions: 0,
            clicks: 0,
            spend: 0,
            results: 0
          };
        }
        acc[key].impressions += Number(demo.impressions) || 0;
        acc[key].clicks += Number(demo.clicks) || 0;
        acc[key].spend += Number(demo.spend) || 0;
        acc[key].results += Number(demo.results) || 0;
        return acc;
      }, {});

      setDemographics(Object.values(aggregated));
    } catch (err: any) {
      console.error('Error loading demographics:', err);
    }
  };

  const getAggregatedDemographics = () => {
    if (demographicView === 'age') {
      const ageAggregated = demographics.reduce((acc: any, demo: any) => {
        const key = demo.age;
        if (!acc[key]) {
          acc[key] = {
            age: demo.age,
            impressions: 0,
            clicks: 0,
            spend: 0,
            results: 0
          };
        }
        acc[key].impressions += demo.impressions;
        acc[key].clicks += demo.clicks;
        acc[key].spend += demo.spend;
        acc[key].results += demo.results;
        return acc;
      }, {});
      return Object.values(ageAggregated);
    } else if (demographicView === 'gender') {
      const genderAggregated = demographics.reduce((acc: any, demo: any) => {
        const key = demo.gender;
        if (!acc[key]) {
          acc[key] = {
            gender: demo.gender,
            impressions: 0,
            clicks: 0,
            spend: 0,
            results: 0
          };
        }
        acc[key].impressions += demo.impressions;
        acc[key].clicks += demo.clicks;
        acc[key].spend += demo.spend;
        acc[key].results += demo.results;
        return acc;
      }, {});
      return Object.values(genderAggregated);
    }
    return demographics;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = (data: any[]) => {
    if (!sortConfig) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const loadAdSets = async (monthlyData: any[]) => {
    try {
      // Aggregate by adset
      const adsetMap = new Map<string, any>();

      monthlyData.forEach((insight) => {
        if (!insight.adset_id) return;

        if (!adsetMap.has(insight.adset_id)) {
          adsetMap.set(insight.adset_id, {
            adset_id: insight.adset_id,
            name: insight.adset_name,
            campaign_id: insight.campaign_id,
            status: 'ACTIVE',
            total_spend: 0,
            total_impressions: 0,
            total_clicks: 0,
            total_results: 0
          });
        }

        const adset = adsetMap.get(insight.adset_id);
        adset.total_spend += Number(insight.spend) || 0;
        adset.total_impressions += Number(insight.impressions) || 0;
        adset.total_clicks += Number(insight.clicks) || 0;
        adset.total_results += Number(insight.results) || 0;
      });

      const metrics = Array.from(adsetMap.values());
      setAdSets(metrics);
    } catch (err: any) {
      console.error('Error loading ad sets:', err);
    }
  };

  const loadAds = async (campaignIds: string[]) => {
    try {
      const { data: adsData } = await supabase
        .from('meta_ads')
        .select('ad_id, name, status, campaign_id')
        .in('campaign_id', campaignIds);

      if (!adsData) return;

      const metricsPromises = adsData.map(async (ad) => {
        const { data: insights } = await supabase
          .from('meta_ad_insights')
          .select('spend, impressions, clicks, results')
          .eq('ad_id', ad.ad_id);

        const totals = (insights || []).reduce((acc, insight) => ({
          spend: acc.spend + (Number(insight.spend) || 0),
          impressions: acc.impressions + (Number(insight.impressions) || 0),
          clicks: acc.clicks + (Number(insight.clicks) || 0),
          results: acc.results + (Number(insight.results) || 0)
        }), { spend: 0, impressions: 0, clicks: 0, results: 0 });

        return {
          ...ad,
          total_spend: totals.spend,
          total_impressions: totals.impressions,
          total_clicks: totals.clicks,
          total_results: totals.results
        };
      });

      const metrics = await Promise.all(metricsPromises);
      setAds(metrics);
    } catch (err: any) {
      console.error('Error loading ads:', err);
    }
  };

  const handleAddAccount = async () => {
    if (!selectedAccountId) return;

    try {
      const { error } = await supabase
        .from('marketing_meta_ad_accounts')
        .insert({
          marketing_project_id: projectId,
          account_id: selectedAccountId,
          client_number: clientNumber,
          marketing_reference: projectId
        });

      if (error) throw error;

      setShowAddModal(false);
      setSelectedAccountId('');
      await loadData();
    } catch (err: any) {
      console.error('Error adding account:', err);
      alert('Error adding account: ' + err.message);
    }
  };

  const handleRemoveAccount = async (linkId: string) => {
    if (!confirm('Remove this ad account from the project?')) return;

    try {
      const { error } = await supabase
        .from('marketing_meta_ad_accounts')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error removing account:', err);
      alert('Error removing account: ' + err.message);
    }
  };

  const handleSyncAccounts = async () => {
    setSyncing(true);
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_ads_access_token')
        .maybeSingle();

      if (!settings?.value) {
        alert('Meta Ads access token not configured. Please go to Admin → Meta Ads to set it up.');
        return;
      }

      const { data: accountIdsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_ads_account_ids')
        .maybeSingle();

      if (!accountIdsData?.value) {
        alert('No ad account IDs configured. Please go to Admin → Meta Ads to set them up.');
        return;
      }

      const accountIds = accountIdsData.value.split(',').map((id: string) => id.trim()).filter((id: string) => id);
      let syncedCount = 0;

      for (const accountId of accountIds) {
        const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
        const url = `https://graph.facebook.com/v21.0/${formattedId}?fields=id,name,currency,account_status,timezone_name,business{id,name}&access_token=${settings.value}`;

        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();

        await supabase
          .from('meta_ad_accounts')
          .upsert({
            account_id: data.id.replace('act_', ''),
            account_name: data.name,
            currency: data.currency,
            account_status: data.account_status,
            timezone_name: data.timezone_name,
            business_id: data.business?.id,
            business_name: data.business?.name,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'account_id'
          });

        syncedCount++;
      }

      alert(`Successfully synced ${syncedCount} ad account(s)`);
      await loadData();
    } catch (err: any) {
      console.error('Error syncing accounts:', err);
      alert('Error syncing accounts: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleTestApiConnection = async (accountId: string) => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-meta-ads-token`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API test failed:', errorData);
        alert(`API test failed: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const testResults = await response.json();
      console.log('API Test Results:', testResults);

      let summary = `Meta Ads API Test Results for ${testResults.accountId}\n\n`;
      testResults.tests.forEach((test: any) => {
        summary += `${test.status} ${test.test}\n`;
        if (test.count !== undefined) {
          summary += `   Found: ${test.count} items\n`;
        }
        if (test.error) {
          summary += `   Error: ${test.error}\n`;
        }
        if (test.reason) {
          summary += `   Reason: ${test.reason}\n`;
        }
        if (test.response?.error) {
          summary += `   API Error: ${test.response.error.message}\n`;
        }
        summary += '\n';
      });

      summary += '\nFull details have been logged to the console.';
      alert(summary);
    } catch (err: any) {
      console.error('Error testing API:', err);
      alert('Error testing API: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncMonthlyReports = async (accountId: string, datePreset?: string) => {
    setSyncingMonthly(true);
    setMonthlyReportResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-monthly-reports`;

      // If no date preset provided, sync the selected month
      let syncDatePreset = datePreset;
      if (!syncDatePreset) {
        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        if (selectedMonth === currentMonth) {
          syncDatePreset = 'this_month';
        } else {
          // For past months, use a custom date range
          const [year, month] = selectedMonth.split('-');
          syncDatePreset = 'last_month'; // Will need to adjust the edge function to support specific months
        }
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: accountId,
          datePreset: syncDatePreset
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync monthly reports');
      }

      const results = await response.json();
      setMonthlyReportResults(results);
      setShowMonthlyReportModal(true);

      await loadData();
    } catch (err: any) {
      console.error('Error syncing monthly reports:', err);
      alert('Error syncing monthly reports: ' + err.message);
    } finally {
      setSyncingMonthly(false);
    }
  };

  const handleSyncCampaigns = async (accountId: string) => {
    setSyncing(true);
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_ads_access_token')
        .maybeSingle();

      if (!settings?.value) {
        alert('Meta Ads access token not configured.');
        return;
      }

      // First, get existing campaigns linked to this marketing project
      const { data: existingCampaigns } = await supabase
        .from('meta_campaigns')
        .select('campaign_id')
        .eq('account_id', accountId)
        .eq('marketing_reference', projectId);

      const existingCampaignIds = existingCampaigns?.map(c => c.campaign_id) || [];

      // Fetch campaign details from Meta API to update them
      if (existingCampaignIds.length > 0) {
        const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

        for (const campaignId of existingCampaignIds) {
          const url = `https://graph.facebook.com/v21.0/${campaignId}?fields=id,name,objective,status,daily_budget,lifetime_budget,created_time,updated_time&access_token=${settings.value}`;

          const response = await fetch(url);
          if (response.ok) {
            const campaign = await response.json();

            await supabase
              .from('meta_campaigns')
              .upsert({
                campaign_id: campaign.id,
                account_id: accountId,
                name: campaign.name,
                objective: campaign.objective,
                status: campaign.status,
                daily_budget: campaign.daily_budget,
                lifetime_budget: campaign.lifetime_budget,
                created_time: campaign.created_time,
                updated_time: campaign.updated_time,
                client_number: clientNumber,
                marketing_reference: projectId,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'campaign_id'
              });
          }
        }
      }

      if (existingCampaignIds.length === 0) {
        alert('No campaigns linked to this marketing project. Please add campaigns first from the Admin → Meta Ads page.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-meta-ads-insights`;

      const insightsResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: accountId,
          campaignIds: existingCampaignIds,
          dateRange: {
            since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            until: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (!insightsResponse.ok) {
        const errorData = await insightsResponse.json();
        console.error('Failed to sync insights:', errorData);
        alert(`Updated ${existingCampaignIds.length} campaign(s), but failed to sync insights: ${errorData.error || 'Unknown error'}`);
      } else {
        const insightsData = await insightsResponse.json();
        console.log('Sync results:', insightsData);

        if (insightsData.errors && insightsData.errors.length > 0) {
          const errorList = insightsData.errors.join('\n');
          alert(`Synced ${existingCampaignIds.length} campaign(s) for this project:\n- ${insightsData.totalAdSets || 0} ad sets found\n- ${insightsData.totalAds} ads found\n- ${insightsData.synced} insights records synced\n\nErrors encountered:\n${errorList}${insightsData.hasMoreErrors ? '\n... and more errors (check console)' : ''}`);
        } else {
          alert(`Successfully synced for this project:\n- ${existingCampaignIds.length} campaign(s)\n- ${insightsData.totalAdSets || 0} ad sets\n- ${insightsData.totalAds} ads\n- ${insightsData.synced} insights records`);
        }
      }

      await loadData();
    } catch (err: any) {
      console.error('Error syncing campaigns:', err);
      alert('Error syncing campaigns: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Meta Ad Accounts</h3>
          <p className="text-sm text-gray-600">Manage ad accounts and track campaign performance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncAccounts}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            Sync All Accounts
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus size={18} />
            Add Account
          </button>
        </div>
      </div>

      {linkedAccounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 mb-4">
            <BarChart3 size={64} className="mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Ad Accounts Linked</h3>
          <p className="text-gray-600 mb-4">
            Add an ad account to start tracking campaign performance
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add Your First Account
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {linkedAccounts.length > 1 && (
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex items-center gap-3">
                <BarChart3 size={20} className="text-gray-600" />
                <label className="text-sm font-medium text-gray-700">Select Account:</label>
                <select
                  value={selectedAccountForView}
                  onChange={(e) => setSelectedAccountForView(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {linkedAccounts.map((link) => (
                    <option key={link.id} value={link.account_id}>
                      {link.meta_ad_accounts.account_name} ({link.meta_ad_accounts.currency})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {linkedAccounts.filter(link => link.account_id === selectedAccountForView).map((link) => (
            <div key={link.id} className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{link.meta_ad_accounts.account_name}</h4>
                  <p className="text-sm text-gray-600">
                    Account ID: {link.account_id} • Currency: {link.meta_ad_accounts.currency}
                  </p>
                  {link.meta_ad_accounts.business_name && (
                    <p className="text-xs text-gray-500">Business: {link.meta_ad_accounts.business_name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSyncMonthlyReports(link.account_id)}
                    disabled={syncingMonthly || syncing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <BarChart3 size={14} className={syncingMonthly ? 'animate-spin' : ''} />
                    Sync Monthly Reports
                  </button>
                  <button
                    onClick={() => handleSyncCampaigns(link.account_id)}
                    disabled={syncing || syncingMonthly}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    Sync Daily Data
                  </button>
                  <button
                    onClick={() => handleTestApiConnection(link.account_id)}
                    disabled={syncing || syncingMonthly}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    <BarChart3 size={14} />
                    Test API
                  </button>
                  <button
                    onClick={() => handleRemoveAccount(link.id)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar size={18} className="text-gray-600" />
                      <label className="text-sm font-medium text-gray-700">View Data For:</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}>
                          Current Month (Month-to-Date)
                        </option>
                        {availableMonths.filter(m => m !== `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`).map(month => {
                          const [year, monthNum] = month.split('-');
                          const date = new Date(Number(year), Number(monthNum) - 1);
                          const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                          return (
                            <option key={month} value={month}>
                              {monthName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="text-sm text-gray-600">
                      {campaigns.length} campaigns • {adSets.length} ad sets
                    </div>
                  </div>
                </div>

                {campaigns.filter(c => c.account_id === link.account_id).length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-600 mb-2 font-medium">
                      No data for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      Click "Sync Monthly Reports" above to fetch data for this month
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-4 border-b border-gray-200">
                      <button
                        onClick={() => setReportView('monthly')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'monthly'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Monthly Overview
                      </button>
                      <button
                        onClick={() => setReportView('campaigns')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'campaigns'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Campaigns
                      </button>
                      <button
                        onClick={() => setReportView('demographics')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'demographics'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Demographics
                      </button>
                      <button
                        onClick={() => setReportView('adsets')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'adsets'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Ad Sets
                      </button>
                      <button
                        onClick={() => setReportView('ads')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'ads'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Ads
                      </button>
                    </div>

                    {reportView === 'monthly' && (
                      <div className="mt-4">
                        <MonthlyPerformanceChart accountId={link.account_id} />
                      </div>
                    )}

                    {reportView === 'campaigns' && (
                      <div className="space-y-3">
                        {campaigns.filter(c => c.account_id === link.account_id).map((campaign) => (
                          <div key={campaign.campaign_id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h5 className="font-medium text-gray-900">{campaign.name}</h5>
                                <p className="text-xs text-gray-600">
                                  {campaign.objective} • {campaign.status}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-5 gap-3 mt-3">
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                                  <DollarSign size={14} />
                                  <span className="text-xs font-medium">Spend</span>
                                </div>
                                <p className="text-sm font-semibold">${campaign.total_spend.toFixed(2)}</p>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                                  <Eye size={14} />
                                  <span className="text-xs font-medium">Impressions</span>
                                </div>
                                <p className="text-sm font-semibold">{campaign.total_impressions.toLocaleString()}</p>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                                  <MousePointer size={14} />
                                  <span className="text-xs font-medium">Clicks</span>
                                </div>
                                <p className="text-sm font-semibold">{campaign.total_clicks.toLocaleString()}</p>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                                  <TrendingUp size={14} />
                                  <span className="text-xs font-medium">Results</span>
                                </div>
                                <p className="text-sm font-semibold">{campaign.total_results.toLocaleString()}</p>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-pink-600 mb-1">
                                  <TrendingUp size={14} />
                                  <span className="text-xs font-medium">CTR</span>
                                </div>
                                <p className="text-sm font-semibold">{campaign.avg_ctr.toFixed(2)}%</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {reportView === 'demographics' && (
                      <div>
                        <div className="flex gap-2 mb-4 border-b border-gray-200">
                          <button
                            onClick={() => { setDemographicView('age'); setSortConfig(null); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              demographicView === 'age'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Demographic
                          </button>
                          <button
                            onClick={() => { setDemographicView('gender'); setSortConfig(null); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              demographicView === 'gender'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Gender
                          </button>
                          <button
                            onClick={() => { setDemographicView('all'); setSortConfig(null); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              demographicView === 'all'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            All
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          {(() => {
                            const displayData = getSortedData(getAggregatedDemographics());

                            if (demographicView === 'age') {
                              return (
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('age')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Age Group
                                          {sortConfig?.key === 'age' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('spend')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Spend
                                          {sortConfig?.key === 'spend' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('impressions')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Impressions
                                          {sortConfig?.key === 'impressions' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('clicks')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Clicks
                                          {sortConfig?.key === 'clicks' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('results')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Results
                                          {sortConfig?.key === 'results' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {displayData.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                          No demographic data available. Sync monthly reports to fetch demographic insights.
                                        </td>
                                      </tr>
                                    ) : (
                                      displayData.map((demo: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                          <td className="px-4 py-2 font-medium">{demo.age}</td>
                                          <td className="px-4 py-2 text-right font-medium">${demo.spend.toFixed(2)}</td>
                                          <td className="px-4 py-2 text-right">{demo.impressions.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.clicks.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.results.toLocaleString()}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              );
                            } else if (demographicView === 'gender') {
                              return (
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('gender')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Gender
                                          {sortConfig?.key === 'gender' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('spend')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Spend
                                          {sortConfig?.key === 'spend' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('impressions')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Impressions
                                          {sortConfig?.key === 'impressions' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('clicks')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Clicks
                                          {sortConfig?.key === 'clicks' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('results')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Results
                                          {sortConfig?.key === 'results' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {displayData.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                          No demographic data available. Sync monthly reports to fetch demographic insights.
                                        </td>
                                      </tr>
                                    ) : (
                                      displayData.map((demo: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                          <td className="px-4 py-2 font-medium capitalize">{demo.gender}</td>
                                          <td className="px-4 py-2 text-right font-medium">${demo.spend.toFixed(2)}</td>
                                          <td className="px-4 py-2 text-right">{demo.impressions.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.clicks.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.results.toLocaleString()}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              );
                            } else {
                              return (
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('age')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Age
                                          {sortConfig?.key === 'age' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('gender')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Gender
                                          {sortConfig?.key === 'gender' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('country')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Country
                                          {sortConfig?.key === 'country' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('spend')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Spend
                                          {sortConfig?.key === 'spend' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('impressions')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Impressions
                                          {sortConfig?.key === 'impressions' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('clicks')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Clicks
                                          {sortConfig?.key === 'clicks' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('results')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Results
                                          {sortConfig?.key === 'results' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {displayData.length === 0 ? (
                                      <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                          No demographic data available. Sync monthly reports to fetch demographic insights.
                                        </td>
                                      </tr>
                                    ) : (
                                      displayData.map((demo: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                          <td className="px-4 py-2">{demo.age}</td>
                                          <td className="px-4 py-2 capitalize">{demo.gender}</td>
                                          <td className="px-4 py-2">{demo.country}</td>
                                          <td className="px-4 py-2 text-right font-medium">${demo.spend.toFixed(2)}</td>
                                          <td className="px-4 py-2 text-right">{demo.impressions.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.clicks.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.results.toLocaleString()}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}

                    {reportView === 'adsets' && (
                      <div className="space-y-2">
                        {adSets.filter(as => campaigns.find(c => c.campaign_id === as.campaign_id && c.account_id === link.account_id)).length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No ad sets found.
                          </p>
                        ) : (
                          adSets
                            .filter(as => campaigns.find(c => c.campaign_id === as.campaign_id && c.account_id === link.account_id))
                            .map((adset) => (
                              <div key={adset.adset_id} className="border border-gray-200 rounded-lg p-3">
                                <h5 className="font-medium text-gray-900 mb-2">{adset.name}</h5>
                                <p className="text-xs text-gray-600 mb-2">{adset.status}</p>
                                <div className="grid grid-cols-4 gap-3">
                                  <div className="text-center">
                                    <p className="text-xs text-gray-600 mb-1">Spend</p>
                                    <p className="text-sm font-semibold">${adset.total_spend.toFixed(2)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-600 mb-1">Impressions</p>
                                    <p className="text-sm font-semibold">{adset.total_impressions.toLocaleString()}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-600 mb-1">Clicks</p>
                                    <p className="text-sm font-semibold">{adset.total_clicks.toLocaleString()}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-600 mb-1">Results</p>
                                    <p className="text-sm font-semibold">{adset.total_results.toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    )}

                    {reportView === 'ads' && (
                      <div className="space-y-2">
                        {ads.filter(ad => campaigns.find(c => c.campaign_id === ad.campaign_id && c.account_id === link.account_id)).length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No ads found.
                          </p>
                        ) : (
                          ads
                            .filter(ad => campaigns.find(c => c.campaign_id === ad.campaign_id && c.account_id === link.account_id))
                            .map((ad) => (
                              <div key={ad.ad_id} className="border border-gray-200 rounded-lg p-3">
                                <h5 className="font-medium text-gray-900 mb-2">{ad.name}</h5>
                                <p className="text-xs text-gray-600 mb-2">{ad.status}</p>
                                <div className="grid grid-cols-4 gap-3">
                                  <div className="text-center">
                                    <p className="text-xs text-gray-600 mb-1">Spend</p>
                                    <p className="text-sm font-semibold">${ad.total_spend.toFixed(2)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-600 mb-1">Impressions</p>
                                    <p className="text-sm font-semibold">{ad.total_impressions.toLocaleString()}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-600 mb-1">Clicks</p>
                                    <p className="text-sm font-semibold">{ad.total_clicks.toLocaleString()}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-600 mb-1">Results</p>
                                    <p className="text-sm font-semibold">{ad.total_results.toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Meta Ad Account</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Ad Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose an account...</option>
                {availableAccounts
                  .filter(acc => !linkedAccounts.some(link => link.account_id === acc.account_id))
                  .map(acc => (
                    <option key={acc.account_id} value={acc.account_id}>
                      {acc.account_name} ({acc.account_id})
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Only showing accounts not already linked to this project
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedAccountId('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!selectedAccountId}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Account
              </button>
            </div>
          </div>
        </div>
      )}

      {showMonthlyReportModal && monthlyReportResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Monthly Report Sync Results</h3>
              <button
                onClick={() => setShowMonthlyReportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-green-700">Campaigns:</span>
                    <span className="ml-2 font-semibold">{monthlyReportResults.campaigns?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-green-700">Ad Sets:</span>
                    <span className="ml-2 font-semibold">{monthlyReportResults.adSets?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-green-700">Insights Synced:</span>
                    <span className="ml-2 font-semibold">{monthlyReportResults.totalInsightsSynced || 0}</span>
                  </div>
                  <div>
                    <span className="text-green-700">Date Preset:</span>
                    <span className="ml-2 font-semibold">{monthlyReportResults.datePreset || 'last_month'}</span>
                  </div>
                </div>
              </div>

              {monthlyReportResults.campaigns && monthlyReportResults.campaigns.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Campaigns Processed</h4>
                  <div className="space-y-2">
                    {monthlyReportResults.campaigns.map((campaign: any) => (
                      <div key={campaign.campaign_id} className="bg-gray-50 rounded p-3">
                        <div className="font-medium text-gray-900">{campaign.name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {campaign.objective} • {campaign.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {monthlyReportResults.errors && monthlyReportResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2">Errors</h4>
                  <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                    {monthlyReportResults.errors.slice(0, 5).map((error: string, idx: number) => (
                      <li key={idx}>{error}</li>
                    ))}
                    {monthlyReportResults.errors.length > 5 && (
                      <li className="text-red-600">... and {monthlyReportResults.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowMonthlyReportModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
