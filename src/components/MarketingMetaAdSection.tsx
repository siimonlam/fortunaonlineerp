import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, Plus, RefreshCw, Trash2, ExternalLink, TrendingUp, DollarSign, Eye, MousePointer, Filter, ChevronDown } from 'lucide-react';

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
  const [reportView, setReportView] = useState<'campaigns' | 'demographics' | 'adsets' | 'ads'>('campaigns');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

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
          loadCampaignMetrics(accountIds);
        }
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignMetrics = async (accountIds: string[]) => {
    try {
      const { data: campaignsData } = await supabase
        .from('meta_campaigns')
        .select('campaign_id, name, status, objective, account_id')
        .in('account_id', accountIds);

      if (!campaignsData) return;

      const metricsPromises = campaignsData.map(async (campaign) => {
        const { data: insights } = await supabase
          .from('meta_ad_insights')
          .select('spend, impressions, clicks, conversions, results, ctr, cpc')
          .eq('campaign_id', campaign.campaign_id);

        if (!insights || insights.length === 0) {
          return {
            ...campaign,
            total_spend: 0,
            total_impressions: 0,
            total_clicks: 0,
            total_conversions: 0,
            total_results: 0,
            avg_ctr: 0,
            avg_cpc: 0
          };
        }

        const totals = insights.reduce((acc, insight) => ({
          spend: acc.spend + (Number(insight.spend) || 0),
          impressions: acc.impressions + (Number(insight.impressions) || 0),
          clicks: acc.clicks + (Number(insight.clicks) || 0),
          conversions: acc.conversions + (Number(insight.conversions) || 0),
          results: acc.results + (Number(insight.results) || 0),
          ctr: acc.ctr + (Number(insight.ctr) || 0),
          cpc: acc.cpc + (Number(insight.cpc) || 0)
        }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, results: 0, ctr: 0, cpc: 0 });

        return {
          ...campaign,
          total_spend: totals.spend,
          total_impressions: totals.impressions,
          total_clicks: totals.clicks,
          total_conversions: totals.conversions,
          total_results: totals.results,
          avg_ctr: insights.length > 0 ? totals.ctr / insights.length : 0,
          avg_cpc: insights.length > 0 ? totals.cpc / insights.length : 0
        };
      });

      const metrics = await Promise.all(metricsPromises);
      setCampaigns(metrics);

      if (metrics.length > 0) {
        const allCampaignIds = metrics.map(c => c.campaign_id);
        loadDemographics(allCampaignIds);
        loadAdSets(allCampaignIds);
        loadAds(allCampaignIds);
      }
    } catch (err: any) {
      console.error('Error loading campaign metrics:', err);
    }
  };

  const loadDemographics = async (campaignIds: string[]) => {
    try {
      const { data: adIds } = await supabase
        .from('meta_ads')
        .select('ad_id')
        .in('campaign_id', campaignIds);

      if (!adIds || adIds.length === 0) return;

      const adIdList = adIds.map(a => a.ad_id);

      const { data: demographics } = await supabase
        .from('meta_ad_insights_demographics')
        .select('age, gender, country, impressions, clicks, spend, results')
        .in('ad_id', adIdList);

      if (!demographics) return;

      const aggregated = demographics.reduce((acc: any, demo: any) => {
        const key = `${demo.age || 'unknown'}_${demo.gender || 'unknown'}_${demo.country || 'unknown'}`;
        if (!acc[key]) {
          acc[key] = {
            age: demo.age || 'Unknown',
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

  const loadAdSets = async (campaignIds: string[]) => {
    try {
      const { data: adSetsData } = await supabase
        .from('meta_adsets')
        .select('adset_id, name, status, campaign_id')
        .in('campaign_id', campaignIds);

      if (!adSetsData) return;

      const metricsPromises = adSetsData.map(async (adset) => {
        const { data: insights } = await supabase
          .from('meta_ad_insights')
          .select('spend, impressions, clicks, results')
          .eq('adset_id', adset.adset_id);

        const totals = (insights || []).reduce((acc, insight) => ({
          spend: acc.spend + (Number(insight.spend) || 0),
          impressions: acc.impressions + (Number(insight.impressions) || 0),
          clicks: acc.clicks + (Number(insight.clicks) || 0),
          results: acc.results + (Number(insight.results) || 0)
        }), { spend: 0, impressions: 0, clicks: 0, results: 0 });

        return {
          ...adset,
          total_spend: totals.spend,
          total_impressions: totals.impressions,
          total_clicks: totals.clicks,
          total_results: totals.results
        };
      });

      const metrics = await Promise.all(metricsPromises);
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

      const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
      const url = `https://graph.facebook.com/v21.0/${formattedId}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,created_time,updated_time&access_token=${settings.value}`;

      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch campaigns');
      }

      const data = await response.json();
      const campaigns = data.data || [];

      for (const campaign of campaigns) {
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
          dateRange: {
            since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            until: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (!insightsResponse.ok) {
        const errorData = await insightsResponse.json();
        console.error('Failed to sync insights:', errorData);
        alert(`Synced ${campaigns.length} campaign(s), but failed to sync insights: ${errorData.error || 'Unknown error'}`);
      } else {
        const insightsData = await insightsResponse.json();
        console.log('Sync results:', insightsData);

        if (insightsData.errors && insightsData.errors.length > 0) {
          const errorList = insightsData.errors.join('\n');
          alert(`Synced ${campaigns.length} campaign(s):\n- ${insightsData.totalAds} ads found\n- ${insightsData.synced} insights records synced\n\nErrors encountered:\n${errorList}${insightsData.hasMoreErrors ? '\n... and more errors (check console)' : ''}`);
        } else {
          alert(`Successfully synced:\n- ${campaigns.length} campaign(s)\n- ${insightsData.totalAds} ads\n- ${insightsData.synced} insights records`);
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
          {linkedAccounts.map((link) => (
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
                    onClick={() => handleSyncCampaigns(link.account_id)}
                    disabled={syncing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    Sync Campaigns
                  </button>
                  <button
                    onClick={() => handleTestApiConnection(link.account_id)}
                    disabled={syncing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
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
                {campaigns.filter(c => c.account_id === link.account_id).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No campaigns found. Click "Sync Campaigns" to fetch data.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2 mb-4 border-b border-gray-200">
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
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Age</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Gender</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Country</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-700">Spend</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-700">Impressions</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-700">Clicks</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-700">Results</th>
                            </tr>
                          </thead>
                          <tbody>
                            {demographics.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                  No demographic data available. Sync campaigns to fetch demographic insights.
                                </td>
                              </tr>
                            ) : (
                              demographics.map((demo, idx) => (
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
    </div>
  );
}
